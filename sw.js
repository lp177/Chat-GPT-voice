'use strict';
var settings={lang:'en-US',speed:1.1,debug:false},speakResumeID=null;
if (typeof browser==='undefined')
    var browser=chrome;
function settingsHydrate(s)
{
    return {
        lang:s['lang']===undefined?'en-US':s['lang'],
        speed:s['speed']===undefined?1.1:parseFloat(s['speed']),
        debug:s['debug']===undefined?false:s['debug'],
    }
}
function sendSettingsToPopup()
{
    browser.storage.local.get(
        ['lang','speed','debug'],
        (data)=>{
            data['query']='getSettings';
            browser.runtime.sendMessage({query:'getSettings',...settingsHydrate(data)});
        }
    );
}
async function resumeIfSpeaking()
{
    // Workaround for know bug
    // https://stackoverflow.com/questions/57667357/speech-synthesis-problem-with-long-texts-pause-mid-speaking
    let isSpeaking = await browser.tts.isSpeaking();
    if (!isSpeaking)
    {
        clearInterval(speakResumeID);
        speakResumeID = null;
    }
    else
    {
        browser.tts.pause();
        browser.tts.resume();
    }
}
function readForMe(txt, tab_id)
{
    browser.tts.speak(
        txt,
        {
            'lang': settings['lang'],
            'rate': settings['speed'],
            onEvent: function(event)
            {
                // if(event.type=='start')
                if(event.type=='end')
                {
                    console.log('End of read');
                    browser.tabs.sendMessage(tab_id, {action: 'swapToPlay'});
                }
            }
        },
        ()=>{
            if(browser.runtime.lastError)
                console.log('TTSError: ', browser.runtime.lastError.message);
            if(!speakResumeID)
                speakResumeID = setInterval(resumeIfSpeaking, 14000);
        }
    );
}
// Router
browser.runtime.onMessage.addListener((request,sender,sendResponse)=>{
    if(settings['debug'])
        console.info('Request: ',request,'\nFrom: ',sender);
    if(request.query==='readForMe')
         readForMe(request.text, sender.tab.id)
    else if(request.query==='getSettingsFromPopup')
        sendSettingsToPopup();
    else if(request.query==='changeSpeed')
    {
        request.value=parseFloat(request.value)
        settings['speed']=request.value;
        browser.storage.local.set({'speed':request.value});
    }
    else if(request.query==='changeLang')
    {
        settings['lang']=request.value;
        browser.storage.local.set({'lang':request.value});
    }
    else if(request.query==='changeDebug')
    {
        settings['debug']=request.value;
        browser.storage.local.set({'debug':request.value});
    }
    else if(request.query==='stop')
        browser.tts.stop();
    else
        console.info('Unmanaged query receive in sw: ', request.query);
    if(sendResponse)
        sendResponse({go:'die'});
});
// Get saved settings
browser.storage.local.get(
    ['lang','speed','debug'],
    (data)=>{
        var name,value;
        for([name,value] of Object.entries(settingsHydrate(data)))
            settings[name] = value;
        console.info('Settings:', settings);
    }
);
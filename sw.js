'use strict';
var settings={lang:'en-US',speed:1.1,debug:false},speakResumeID=null;
if (typeof browser==='undefined')
    var browser=chrome;
function settingsHydrate(s)
{
    return {
        lang:s['lang']===undefined?'en-US':s['lang'],
        speed:s['speed']===undefined?1.1:parseFloat(s['speed']),
        autoread:s['autoread']===undefined?false:s['autoread'],
        debug:s['debug']===undefined?false:s['debug'],
    }
}
function sendSettingsToPopup()
{
    browser.storage.local.get(
        ['lang','speed','debug','autoread'],
        (data)=>{
            data['query']='getSettings';
            browser.runtime.sendMessage({query:'getSettings',...settingsHydrate(data)});
        }
    );
}
function sendSettingsToTab(tab_id)
{
    browser.storage.local.get(
        ['lang','debug','autoread'],
        (data)=>{
            data['query']='getSettings';
            browser.tabs.sendMessage(tab_id, {action: 'getSettings',...settingsHydrate(data)});
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
function readForMe(txt, tab_id, enqueue=false)
{
    if(settings['debug'])
        console.info('Read in ', settings['lang']);
    browser.tts.speak(
        txt,
        {
            'lang': settings['lang'],
            'rate': settings['speed'],
            'enqueue': enqueue,
            onEvent: function(event)
            {
                // if(event.type=='start')
                if(event.type=='end')
                    setTimeout(async ()=>{
                        let isSpeaking = await browser.tts.isSpeaking();
                        if(!isSpeaking)
                            browser.tabs.sendMessage(tab_id, {action: 'swapToPlay'});
                    },10);
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
async function updateTabsSettings()
{
    for(const cs of browser.runtime.getManifest().content_scripts)
    {
        for(const tab of await browser.tabs.query({url:cs.matches}).catch((e)=>settings['debug']?console.warn('Fail to access to a zombie tab'):null))
            sendSettingsToTab(tab.id);
    }
}
// Router
browser.runtime.onMessage.addListener((request,sender,sendResponse)=>{
    if(settings['debug'])
        console.info('Request: ',request,'\nFrom: ',sender);
    if(request.query==='readForMe')
         readForMe(request.text, sender.tab.id, request['enqueue']?request['enqueue']:false)
    else if(request.query==='getSettingsFromPopup')
        sendSettingsToPopup();
    else if(request.query==='getSettingsFromTab')
        sendSettingsToTab(sender.tab.id);
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
        updateTabsSettings();
    }
    else if(request.query==='changeDebug')
    {
        settings['debug']=request.value;
        browser.storage.local.set({'debug':request.value});
        updateTabsSettings();
    }
    else if(request.query==='changeAutoread')
    {
        if(!request.value)
            browser.tts.stop();
        settings['autoread']=request.value;
        browser.storage.local.set({'autoread':request.value});
        updateTabsSettings();
    }
    else if(request.query==='stop')
    {
        browser.tts.stop();
        browser.tabs.sendMessage(sender.tab.id, {action: 'swapToPlay'});
    }
    else
        console.info('Unmanaged query receive in sw: ', request.query);
    if(sendResponse)
        sendResponse({go:'die'});
});
// Get saved settings
browser.storage.local.get(
    ['lang','speed','debug','autoread'],
    (data)=>{
        var name,value;
        for([name,value] of Object.entries(settingsHydrate(data)))
            settings[name] = value;
        if(settings['debug'])
            console.info('Settings:', settings);
    }
);
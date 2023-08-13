'use strict';
const q=document.querySelector.bind(document),qa=document.querySelectorAll.bind(document),c=console;
var debug=false;
if (typeof browser==='undefined')
    var browser=chrome;
function listenInputChanges(names)
{
    for(let name of names)
    {
        let input=q('input[name="'+name+'"],select[name="'+name+'"]');
        if(!input)
            return c.error('Fail to listen input with name = ', name);
        input.addEventListener(
            'input',
            ((input)=>()=>{
                browser.runtime.sendMessage({
                    query:'change'+name.charAt(0).toUpperCase()+name.slice(1),
                    value:(input.getAttribute('type')=='checkbox')?input.checked:input.value
                })
            })(input)
        );
    }
}
function getSettings(msg)
{
    delete msg['query'];
    debug=msg['debug'];
    if(debug)
        c.info('Received settings: ', msg);
    var name,value;
    for([name,value] of Object.entries(msg))
    {
        let input = q('input[name="'+name+'"],select[name="'+name+'"]');
        if(input)
        {
            if(input.getAttribute('type')=='checkbox')
                input.checked = value;
            else if(input.getAttribute('type')=='select')
                input.selected = value;
            else
                input.value = value;
        }
        else
            c.error('Fail to find input with name = ', name);
    }
    listenInputChanges(['speed','lang','autoread','debug']);
}
// Receive and set saved values
browser.runtime.onMessage.addListener(function(msg,sender,sendResponse)
{
    if(msg.query==='getSettings')
        getSettings(msg);
    else if(debug)
        c.info('Unmanaged message receive in settings page: ',msg);
    if(sendResponse)
        sendResponse({go:'die'});
});
function init()
{
    browser.runtime.sendMessage({query:'getSettingsFromPopup'});
}
setTimeout(init,0);
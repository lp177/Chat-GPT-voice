'use strict';
const q=document.querySelector.bind(document),qa=document.querySelectorAll.bind(document),c=console,debug=false;
var lastRearmID=null,lastPlayElement=null;
if (typeof browser==='undefined')
    var browser=chrome;
function swapToStop()
{
    if(!lastPlayElement)
        return;
    lastPlayElement.innerHTML = `<svg
        title="stop"
        stroke="black"
        fill="black"
        stroke-width="1"
        viewBox="0 0 24 24"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="h-4 w-4"
        height="1em"
        width="1em"
        xmlns="http://www.w3.org/2000/svg"
    >
        <rect x="4" y="4" width="18" height="18"/>
    </svg>`;
    if(debug)
        c.log('Swap ', lastPlayElement, ' to stop');
}
function swapToPlay()
{
    for(let player of qa('.ttsInjected svg[title="stop"]'))
        player.parentNode.innerHTML = `<svg
            title="play"
            stroke="currentColor"
            fill="none"
            stroke-width="2"
            viewBox="0 0 24 24"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-4 w-4"
            height="1em"
            width="1em"
            xmlns="http://www.w3.org/2000/svg"
        >
            <polygon points="10,4 10,24 22,14"/>
        </svg>`;
    if(debug)
        c.log('Swap ', lastPlayElement, ' to play');
    lastPlayElement=null;
}
function play(e,UISection)
{
    var max_parent_jump=5,button=e.target;
    while(button.tagName!='BUTTON'&&max_parent_jump--)
        button=button.parentNode;
    if(button.tagName!='BUTTON')
        return c.error('Fail to locate tts button!');
    swapToPlay();
    lastPlayElement=UISection.querySelector('.ttsInjected');
    swapToStop();
    const textElement=button.parentNode.parentNode.parentNode.querySelector('div .markdown');
    if(debug)
        c.info('Read: ', textElement);
    browser.runtime.sendMessage({
        query:'readForMe',
        text:textElement.innerText
    });
}
function togglePlay(e,UISection)
{
    if(UISection.querySelector('svg[title="stop"]'))
    {
        browser.runtime.sendMessage({
            query:'stop'
        });
        swapToPlay();
    }
    else
        play(e,UISection);
}
function insertTTSButtons(rearmCount=0)
{
    if(rearmCount==0&&lastRearmID)
        clearTimeout(lastRearmID);
    var insertedCount=0,add_css='';
    // Past icons
    var targets=qa('.text-token-text-primary.dark\\:bg-\\[\\#444654\\] path[d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"]');
    if(!targets||targets.length<1)
    {
        add_css='margin-bottom:-37px;';
        targets=qa('.markdown.prose');
    }
    if(debug)
        c.info('Targets found: ', targets);
    for(let target of targets)
    {
        let UISection = target.parentNode.parentNode.parentNode;
        if(UISection.querySelector('.ttsInjected'))
            continue;
        insertedCount++;
        if(debug)
            c.info('Insert UI at ', UISection);
        UISection.insertAdjacentHTML(
            'afterBegin',
            `<button
                style="${add_css}"
                class="ttsInjected flex ml-auto gap-2 rounded-md p-1 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 disabled:dark:hover:text-gray-400"
            >
                <svg
                    title="play"
                    stroke="currentColor"
                    fill="none"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="h-4 w-4"
                    height="1em"
                    width="1em"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <polygon points="10,4 10,24 22,14"/>
                </svg>
            </button>`
        );
        UISection.querySelector('.ttsInjected').addEventListener(
            'click',
            ((UISection)=>(e)=>togglePlay(e,UISection))(UISection)
        );
    }
    if(insertedCount<1&&rearmCount<100)
        lastRearmID=setTimeout(()=>{
            lastRearmID=null;
            insertTTSButtons(++rearmCount);
        }, 500);
}
insertTTSButtons();
const sendQuestionButton=q('form svg path[d="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837a1 1 0 0 1 0 1.766L1.969 15.72A1 1 0 0 1 .5 14.836V10.33a1 1 0 0 1 .816-.983L8.5 8 1.316 6.653A1 1 0 0 1 .5 5.67V1.163Z"]');
q('body').addEventListener(
    'click',
    ()=>setTimeout(insertTTSButtons,500)
);
browser.runtime.onMessage.addListener(function(msg,sender,sendResponse)
{
    if(debug)
        console.info('Page receive msg: ', msg);
    if(msg.action==='swapToPlay')
        swapToPlay();
    else if(debug)
        console.info('Unmanaged msg receive in page: ', msg.action);
});
'use strict';

const q=document.querySelector.bind(document),
qa=document.querySelectorAll.bind(document),
c=console;
var lastPlayElement=null,
promptInput,
promptSubmit,
readLiveResponseBuffer='',
timerSearchPromptSubmit,
timers={
    'insertSTTButtonTimer': null,
    'insertTTSButtonsTimer': null,
    'searchForNewResponseTimer': null,
},
settings={
    'debug':false,
    'lang':'en-US',
    'autoread': false
},
is_recognition_running;

if (typeof browser==='undefined')
    var browser=chrome;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
const SpeechRecognitionEvent = window.SpeechRecognitionEvent || window.webkitSpeechRecognitionEvent;
const recognition = new SpeechRecognition();

recognition.continuous = false;
recognition.lang = settings['lang'];
recognition.interimResults = true;
recognition.maxAlternatives = 1;
// const speechRecognitionList = new SpeechGrammarList();

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
    if(settings['debug'])
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
    if(settings['debug'])
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
    if(settings['debug'])
        c.info('Read: ', textElement);
    browser.runtime.sendMessage({
        query:'readForMe',
        text:textElement.innerText
    });
}
function playEnqueue(msg)
{
    browser.runtime.sendMessage({
        query:'readForMe',
        text:msg,
        enqueue:true
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
function listenUser()
{
    if(is_recognition_running)
        return;
    is_recognition_running = true;
    recognition.lang = settings['lang'];
    recognition.start();
    recognition.onresult = (event)=>{
        if(settings['debug'])
            c.info('recognition.result:', event);
        promptInput.value = ' '+event.results[0][0].transcript;
        promptInput.dispatchEvent(new Event('input',{bubbles:true}));
        promptInput.dispatchEvent(new Event('change',{bubbles:true}));
    };
    recognition.onspeechend = () => {
        if(settings['debug'])
            c.info('recognition.end');
        recognition.stop();
        is_recognition_running = false;
        setTimeout(()=>q(
                'svg path[d="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837a1 1 0 0 1 0 1.766L1.969 15.72A1 1 0 0 1 .5 14.836V10.33a1 1 0 0 1 .816-.983L8.5 8 1.316 6.653A1 1 0 0 1 .5 5.67V1.163Z"]'
            ).parentNode.parentNode.click(),
            100
        );
    };
    recognition.onnomatch = (event) => {
        if(settings['debug'])
            c.info('recognition.fail:', event);
        recognition.stop();
        is_recognition_running = false;
    };
}
function getSettings(msg)
{
    var name,value;
    for([name,value] of Object.entries(msg))
        settings[name] = value;
}
function avoidConcurrency(retried,timerName)
{
    // Idealy: Wait end of previous for launch a new for avoid bad luck concurrency in case of UI spaming (maybe later...)
    if(retried!=0||!timers[timerName])
        return;
    clearTimeout(timers[timerName]);
    timers[timerName]=null;
}
function insertTTSButtons(retried=0)
{
    avoidConcurrency(retried,'insertTTSButtonsTimer');
    var insertedCount=0,add_css='';
    // Past icons
    var targets=qa('.text-token-text-primary.dark\\:bg-\\[\\#444654\\] path[d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"]');
    if(!targets||targets.length<1)
    {
        add_css='margin-bottom:-37px;';
        targets=qa('.markdown.prose');
    }
    if(settings['debug'])
        c.info('Targets found: ', targets);
    for(let target of targets)
    {
        let UISection = target.parentNode.parentNode.parentNode;
        if(UISection.querySelector('.ttsInjected'))
            continue;
        insertedCount++;
        if(settings['debug'])
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
        if(settings['autoread']&&UISection.querySelector('.ttsInjected').parentNode.parentNode.parentNode.querySelector('.ttsInReading'))
        {
            lastPlayElement=UISection.querySelector('.ttsInjected');
            swapToStop();
        }
        UISection.querySelector('.ttsInjected').addEventListener(
            'click',
            ((UISection)=>(e)=>togglePlay(e,UISection))(UISection)
        );
    }
    if(insertedCount<1&&retried<100)
        timers['insertTTSButtonsTimer']=setTimeout(()=>{
            timers['insertTTSButtonsTimer']=null;
            insertTTSButtons(retried+1);
        }, 100);
}
function insertSTTButton(retried=0)
{
    avoidConcurrency(retried,'insertSTTButtonTimer');
    promptInput=document.querySelector('#prompt-textarea');
    if(!promptInput)
    {
        if(retried<100)
            timers['insertSTTButtonTimer']=setTimeout(()=>{
                timers['insertSTTButtonTimer']=null;
                insertSTTButton(retried+1)
            },300);
        return;
    }
    if(document.querySelector('#sttInjected'))
        return settings['debug']?c.warn('Already injected STTButton'):undefined;
    promptInput.insertAdjacentHTML(
        'afterEnd',
        `<button
            id="sttInjected"
            style="right: 2.5rem;top:0.6rem;"
            class="absolute p-1 rounded-md md:bottom-3 md:p-2 md:right-3 dark:hover:bg-gray-900 dark:disabled:hover:bg-transparent right-2 disabled:text-gray-400 text-white bottom-1.5 transition-colors disabled:opacity-40">
            <svg
                x="0px"
                y="0px"
                fill="white"
                width="22px"
                height="22px"
                viewBox="0 0 24 24"
                xml:space="preserve"
                stroke="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <g id="Layer_1">
                    <g>
                        <path d="M12,16c-2.206,0-4-1.795-4-4V6c0-2.205,1.794-4,4-4s4,1.795,4,4v6C16,14.205,14.206,16,12,16z M12,4c-1.103,0-2,0.896-2,2
                            v6c0,1.104,0.897,2,2,2s2-0.896,2-2V6C14,4.896,13.103,4,12,4z"/>
                    </g>
                    <path d="M19,12v-2c0-0.553-0.447-1-1-1s-1,0.447-1,1v2c0,2.757-2.243,5-5,5s-5-2.243-5-5v-2c0-0.553-0.447-1-1-1s-1,0.447-1,1v2
                        c0,3.52,2.613,6.432,6,6.92V20H8c-0.553,0-1,0.447-1,1s0.447,1,1,1h8c0.553,0,1-0.447,1-1s-0.447-1-1-1h-3v-1.08
                        C16.387,18.432,19,15.52,19,12z"/>
                </g>
            </svg>
        </button>`
    );
    document.querySelector('#sttInjected').addEventListener('click', listenUser);
}
function searchForNewResponse(retried=0)
{
    if(!settings['autoread'])
        return;
    avoidConcurrency(retried,'searchForNewResponseTimer');
    const stopGenerationBt=q('button svg rect[x="3"][y="3"][width="18"][height="18"][rx="2"][ry="2"]');
    if(!stopGenerationBt)
    {
        for(let response of qa('.markdown.prose:not(.tssReaded):not(.ttsInReading)'))
            response.classList.add('tssReaded');
        if(retried<30)
            timers['searchForNewResponseTimer']=setTimeout(()=>{
                timers['searchForNewResponseTimer']=null;
                searchForNewResponse(retried+1);
            },100);
        return;
    }
    if(settings['debug'])
        c.info('Stop button detected: ', stopGenerationBt);
    let responses=qa('.markdown.prose:not(.tssReaded):not(.ttsInReading)');
    if(!responses||!responses.length)
    {
        if(retried<100)
            timers['searchForNewResponseTimer']=setTimeout(()=>{
                timers['searchForNewResponseTimer']=null;
                searchForNewResponse(retried+1);
            },100);
        if(settings['debug'])
            c.info('Nothing to read');
        return;
    }
    responses=responses[responses.length-1];
    if(settings['debug'])
        c.info('Found new response: ', responses);
    if(responses.classList.contains('ttsInReading'))
        return settings['debug']?c.info('Already in reading'):undefined;
    readLiveResponseBuffer='';
    responses.classList.add('ttsInReading');
    readLiveResponse(responses)
}
function readLiveResponse(wrapper)
{
    let text=wrapper.innerText;
    text=text.substring(readLiveResponseBuffer.length);
    let parts=text.split(/(?<=[\n,.!?])/);
    if(length<2)
    {
        if(settings['debug'])
            c.log('Not enought text for read: ', text);
        return setTimeout(()=>readLiveResponse(wrapper),100);
    }
    while(parts.length>1)
    {
        let msg=parts.shift();
        if(settings['debug'])
            c.log('Reading: ', msg);
        playEnqueue(msg);
        readLiveResponseBuffer+=msg;
    }
    if(q('button svg rect[x="3"][y="3"][width="18"][height="18"][rx="2"][ry="2"]'))
        return setTimeout(()=>readLiveResponse(wrapper),100);
    if(parts.length)
    {
        if(settings['debug'])
            c.log('Reading: ', msg);
        playEnqueue(parts[0]);
    }
    wrapper.classList.add('tssReaded');
    wrapper.classList.remove('ttsInReading');
}
insertSTTButton();
insertTTSButtons();
const sendQuestionButton=q('form svg path[d="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837a1 1 0 0 1 0 1.766L1.969 15.72A1 1 0 0 1 .5 14.836V10.33a1 1 0 0 1 .816-.983L8.5 8 1.316 6.653A1 1 0 0 1 .5 5.67V1.163Z"]');
q('body').addEventListener(
    'click',
    ()=>setTimeout(()=>{
        insertTTSButtons();
        insertSTTButton();
        searchForNewResponse();
    },100)
);
q('body').addEventListener(
    'keypress',
    ()=>setTimeout(()=>{
        searchForNewResponse();
    },100)
);
setTimeout(()=>{
    for(let response of qa('.markdown.prose:not(.tssReaded):not(.ttsInReading)'))
        response.classList.add('tssReaded');
}, 450);
browser.runtime.onMessage.addListener(function(msg,sender,sendResponse)
{
    if(settings['debug'])
        c.info('Page receive msg: ', msg);
    if(msg.action==='swapToPlay')
        swapToPlay();
    else if(msg.action==='getSettings')
        getSettings(msg);
    else if(settings['debug'])
        c.info('Unmanaged msg receive in page: ', msg.action);
});
browser.runtime.sendMessage({
    query:'getSettingsFromTab'
});
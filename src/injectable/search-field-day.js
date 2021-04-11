/**
 * Search Field Day
 *
 * This script cycles through all the players, about pages, and feature pages
 * searching for a specific string in DOM text, classes and IDs. When it finds
 * the text it highlights and reports where it was found.
 *
 * This script is meant to be executed from a bookmark. It uses a technique called
 * JavaScript injection which allows adding code dynamically to a page without
 * modifying it permanently.
 *
 * To run, create a bookmark in your browser with the following content in the URL field:
 *
 * javascript:;var js = document.createElement("script");js.type = "text/javascript";js.src = "/dtc-FieldDay/scripts/testing/injected/search-for-text.js";document.body.appendChild(js);
 */

(function () {

    /** Time to wait between transitions */
    const PAUSE = 1000;

    /** Simple finite state machine that iterates over all players, PDP screens, About, and Features screen */
    const FSM = [
        {selector: "#attract", name: "START_LISTENING", comment: "Click on Start Listening"},
        {selector: ".q4-player-box", name: "OPEN_PLAYERS", count: "*", comment: "Click on each player one at a time",
            fsm: [
                {selector: ".areaVideoBack", name: "CLOSE_VIDEO", comment: "Close video if any"},
                {selector: ".q4-player-compare", name: "LEARN_MORE", count: "*", comment: "Click Learn More"},
                {selector: ".q2-pdp-info-next", name: "ARROW_RIGHT", comment: "Click right arrow"},
                {selector: ".q2-pdp-info-next", name: "ARROW_RIGHT", comment: "Click right arrow again"},
                {selector: ".q2-pdp-info-next", name: "ARROW_RIGHT", comment: "Click right arrow again"},
                {selector: ".q2-pdp-info-next", name: "ARROW_RIGHT", comment: "Click right arrow again"},
                {selector: ".q2-pdp-specifications", name: "SPECIFICATIONS", comment: "Click Specifications"},
                {selector: ".q2-catalog-exit-specs-compare", name: "CLOSE_SPECIFICATIONS", comment: "Close Specifications"},
                {selector: ".q2-pdp-compare", name: "COMPARE", comment: "Click Compare"},
                {selector: ".q2-catalog-exit-specs-compare", name: "CLOSE_COMPARE", comment: "Close Compare"},
                {selector: ".q2-pdp-page-close", name: "CLOSE_LEARN_MORE", comment: "Close Learn More"}
            ]},
        {selector: ".q2-top-menu-text", name: "TOP_MENU", count: "*", comment: "Iterate over the top menus",
            fsm: [
                {selector: ".q2-about-next", name: "ABOUT_NEXT", comment: "In About menu, click next arrow"},
                {selector: ".q2-about-next", name: "ABOUT_NEXT", comment: "In About menu, click next arrow again"},
                {selector: ".q2-about-next", name: "ABOUT_NEXT", comment: "In About menu, click next arrow again"},
                {selector: ".q2-about-next", name: "ABOUT_NEXT", comment: "In About menu, click next arrow again"},
                {selector: ".q2-catalog-right-scroll", name: "FEATURE_NEXT", comment: "In Features menu, click next"},
                {selector: ".q2-catalog-right-scroll", name: "FEATURE_NEXT", comment: "In Features menu, click next again"},
                {selector: ".q2-catalog-right-scroll", name: "FEATURE_NEXT", comment: "In Features menu, click next again"},
                {selector: ".q2-catalog-right-scroll", name: "FEATURE_NEXT", comment: "In Features menu, click next again"},
            ]
        },
    ];
    let LOCAL_STORAGE_KEY = "SEARCH_FD";
    let fsmIndex = 0; // iterate over FSM states
    let queue = []; // as we iterate over states, enqueue selectors to be clicked in FIFO order
    let interval = null; // interval that runs a clock that drives the whole thing
    let output; // textarea to log elements found
    let elementsFoundMap = {}; // map to keep track of elements found with text. Keys are CSS classes
    let textToFind = "ROAMSL"; // text we're looking for

    /**
     * UI to enter text to search for and report where it was found.
     * Disabling Search and Pause button for now since they are experimental.
     * Textarea reports all elements, classes, and IDs where the text was found.
     */
    const UI = `
        <div>
            <input id="input" value="${textToFind}" readonly/>
            <button id="search" disabled>Search</button>
            <button id="pause" disabled>Pause</button>
            <button id="done">Skip</button>
            <br/>
            <textarea style="margin-top: 5px" cols="29" rows="5" id="output"></textarea>
        </div>`

    /** Entry point */
    const main = () => {
        // uncomment to figure out elements when clicked
        // $("body *").on("click", (event) => {console.log(event.target)})
        setupUi();
        loadLogFromLocalStorage()
        runTest();
    }
    $(main);

    /** Adds UI to DOM, initializes output log, start search when search button clicked */
    const setupUi = () => {
        $(UI).css({
            position: "fixed",
            left: "10px",
            top: "10px",
            zIndex: "10",
            border: "none"
        }).appendTo("body");

        output = $("#output");
        $("#search").click(runTest);
        $("#done").click(done);
        $("#pause").click(() => {
            clearInterval(interval);
        });
    }

    /** Start a clock that drives the FSM at every tick */
    const runTest = () => {
        interval = setInterval(() => {
            tick();
        }, PAUSE)
    }

    /** Loads log of elements where text was found */
    const loadLogFromLocalStorage = () => {
        // retrieve elements found so far from local storage and copy to local map
        let elementsFoundLog = localStorage.getItem(LOCAL_STORAGE_KEY)
        if(elementsFoundLog) {
            elementsFoundLog = JSON.parse(elementsFoundLog)
            elementsFoundMap = {...elementsFoundLog}
        }
        // report elements in textarea
        Object.keys(elementsFoundMap).forEach((clazz) => {
            const tagName = elementsFoundMap[clazz]
            output.append(`&lt;${tagName} class="${clazz}"/&gt;\n`);
        })
    }

    /** Appends elements where text was found to the log and saves to local storage */
    const logElementsFoundToLocalStorage = () => {
        // get log from local storage. Initialize if not there
        let elementsFoundLog = localStorage.getItem(LOCAL_STORAGE_KEY)
        if(!elementsFoundLog) {
            elementsFoundLog = {};
        } else {
            elementsFoundLog = JSON.parse(elementsFoundLog);
        }
        // append to the log elements where we found the text
        elementsFoundLog = {
            ...elementsFoundLog,
            ...elementsFoundMap
        };
        // store the log back to local storage
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(elementsFoundLog));
    }

    /**
     * Function called repeatedly every PAUSE milliseconds
     * until FSM is complete and queue is empty
     */
    const tick = () => {
        // at each tick of the clock, find and highlight the text
        searchAndHighlightElementsContainingText(textToFind)

        // navigate field day based on the FSM
        navigateFsm();
    }

    /**
     * Navigate through field day based on states declared in FSM.
     * At each tick of the clock, check what's the current state,
     * grab the DOM element in state.selector and click it
     */
    const navigateFsm = () => {

        // if queue is empty, and there're no more states, stop
        if(fsmIndex >= FSM.length && isQueueEmpty()) {
            done();
            return;
        }

        // if queue is empty, grab next state from FSM and enqueue the next DOM element
        if(isQueueEmpty()) {
            const state = FSM[fsmIndex];
            const selector = state.selector;
            const $element = $(selector);

            // if the state has a count, then there can be more than one element per selector,
            // enqueue them to be clicked, and keep an index in the state to click them in order
            if(typeof state.count !== "undefined") {

                if((typeof state.count === "number" || state.count === "*") && state.index >= $element.length) {
                    // if the count is a number, then we're done cycling through them when index reaches count
                    // if the count is "*", then we don't know how many there are,
                    // we'll just click through them all until we reach the size of the elements
                    // then we can advance to next state in the FSM
                    fsmIndex++;
                } else {
                    // if the index has not yet reached the count,
                    // then enqueue each of the elements to be clicked in order
                    if(typeof state.index === "undefined") {
                        // if this is the first time, initialize the index
                        state.index = 0
                    }
                    // enqueue the next element
                    // jQuery unwraps indexed elements,
                    // so we need to re-wrap it with $
                    enqueue($($element[state.index]));
                    if(state.fsm) {
                        // if there are sub states (sub FSM), iterate over each
                        // and enqueue them to be clicked in order
                        state.fsm.forEach((subState) => {
                            const selector = subState.selector;
                            const $element = $(selector);
                            if(subState.count === "*") {
                                enqueue($($element[state.index]));
                            } else {
                                enqueue($element);
                            }
                        })
                    }
                    // advance to the next index
                    state.index++;
                }
            } else {
                // if there's no count, then this is just one element,
                // and we can enqueue it to be clicked in the order
                // defined in the FSM
                enqueue($element);
                fsmIndex++;
            }
        } else {
            // if queue is not empty, then grab next element from queue and click it
            // skip over elements that are not visible
            let $element;
            do {
                $element = dequeue();
                if(typeof $element === "undefined") {
                    continue;
                }
            } while($element && !$element.is(":visible"));
            click($element);
        }
    }

    /**
     * Iterate over all the DOM elements, retrieve their classes, IDs, and text,
     * check if any of them contains stringToFind, if so, highlight the element
     * @param {string} stringToFind - string to find in DOM's class attribute
     */
    const searchAndHighlightElementsContainingText = (stringToFind) => {

        // convert all strings to uppercase so we can ignore case
        stringToFind = stringToFind.toUpperCase();

        // grab all the elements from the DOM
        // and iterate over them
        const allDomElements = $("*");

        // using a "function" because jQuery.each() relies on "this" legacy behavior
        allDomElements.each(function (index) {

            // in jQuery.each() function, "this" refers to the current DOM element
            // also, in JavaScript keyword "this" changes, so let's save it's original meaning
            const self = this;
            const $self = $(self);

            // highlight DOM element if it's text contains stringsToFind
            // ignore branches in DOM tree. Only highlight leaves
            const text = $self.text().replace(/\n/g, " ").toUpperCase();
            if(text.indexOf(stringToFind) >=0 && $self.children().length === 0) {
                highLightElement($self, "red");
            }

            // highlight DOM element if it's ID contains stringsToFind
            if(self.id && self.id.toUpperCase().indexOf(stringToFind) >= 0) {
                highLightElement($self, "blue");
            }

            // if the DOM element has classes
            if(self.className) {
                // then make an array from the classes in the class attribute
                const classArray = self.className.split(' ');

                // find a class that contains stringToFind as substring
                const found = classArray.find((clazz) => {
                    return clazz.toUpperCase().indexOf(stringToFind) >= 0;
                })
                // if we find a class, then highlight element
                if(found) {
                    highLightElement($self, "yellow")
                }
            }
        })
    }

    /**
     * Highlight $element's border with color. Also log the $element to the output textarea
     * @param $element
     * @param color
     */
    const highLightElement = ($element, color) => {
        const tagName = $element.prop("tagName");
        const id = $element.attr("id");
        const clazz = $element.attr("class");
        // don't report output textarea
        if(id === "output") {
            return
        }
        if(!elementsFoundMap[clazz]) {
            output.append(`&lt;${tagName} class="${clazz}"/&gt;\n`);
            elementsFoundMap[clazz] = tagName;
        }
        $element.css({
            borderColor: color,
            borderWidth: "2px",
            borderStyle: "solid"
        })
    }

    /**
     * Simulates low level click event
     * @param {string} selector - CSS selector of element to click
     */
    const click = (selector) => {
        const domElement = $(selector)[0];
        if (document.createEvent && domElement) {
            const event = document.createEvent("MouseEvents");
            event.initMouseEvent(
                "click",
                true, true,
                window,
                0, 0, 0, 0, 0,
                false, false, false, false, 0, null);
            try {
                const allowDefault = domElement.dispatchEvent(event);
            } catch (e) {
                console.log(e);
            }
        }
    }

    /** Enqueue element to be clicked in FIFO order */
    const enqueue = (item) => {
        if(typeof item !== "undefined") {
            queue.push(item);
        }
    }

    /** Dequeue element so we can click it */
    const dequeue = () => {
        return queue.shift();
    }

    const isQueueEmpty = () => {
        return queue.length === 0;
    }

    /** When script is done, save elements found to local storage, stop clock, send message to top frame */
    const done = () => {
        logElementsFoundToLocalStorage();
        clearInterval(interval);
        window.top.postMessage("DONE", "*")
    }
})();

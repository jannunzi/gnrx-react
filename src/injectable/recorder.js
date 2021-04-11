(function () {

    const main = () => {
        $("body").on("click")
    }
    $(main);

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

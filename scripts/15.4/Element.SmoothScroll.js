// https://github.com/iamdustan/smoothscroll
"use strict";

// polyfill
function polyfill() {
    // aliases
    var w = window;
    var d = document;

    // return if scroll behavior is supported and polyfill is not forced
    if (
        "scrollBehavior" in d.documentElement.style &&
        w.__forceSmoothScrollPolyfill__ !== true
    ) {
        return;
    }

    // globals
    var Element = w.HTMLElement || w.Element;
    var SCROLL_TIME = 468;

    // object gathering original scroll methods
    var original = {
        scroll: w.scroll || w.scrollTo,
        scrollBy: w.scrollBy,
        elementScroll: Element.prototype.scroll || scrollElement,
        scrollIntoView: Element.prototype.scrollIntoView,
    };

    // define timing method
    var now =
        w.performance && w.performance.now
            ? w.performance.now.bind(w.performance)
            : Date.now;

    /**
     * changes scroll position inside an element
     * @method scrollElement
     * @param {Number} x
     * @param {Number} y
     * @returns {undefined}
     */
    function scrollElement(x, y) {
        this.scrollLeft = x;
        this.scrollTop = y;
    }

    /**
     * returns result of applying ease math function to a number
     * @method ease
     * @param {Number} k
     * @returns {Number}
     */
    function ease(k) {
        return 0.5 * (1 - Math.cos(Math.PI * k));
    }

    /**
     * indicates if a smooth behavior should be applied
     * @method shouldBailOut
     * @param {Number|Object} firstArg
     * @returns {Boolean}
     */
    function shouldBailOut(firstArg) {
        if (
            firstArg === null ||
            typeof firstArg !== "object" ||
            firstArg.behavior === undefined ||
            firstArg.behavior === "auto" ||
            firstArg.behavior === "instant"
        ) {
            // first argument is not an object/null
            // or behavior is auto, instant or undefined
            return true;
        }

        if (typeof firstArg === "object" && firstArg.behavior === "smooth") {
            // first argument is an object and behavior is smooth
            return false;
        }

        // throw error when behavior is not supported
        throw new TypeError(
            "behavior member of ScrollOptions " +
                firstArg.behavior +
                " is not a valid value for enumeration ScrollBehavior."
        );
    }

    /**
     * indicates if an element has scrollable space in the provided axis
     * @method hasScrollableSpace
     * @param {Node} el
     * @param {String} axis
     * @returns {Boolean}
     */
    function hasScrollableSpace(el, axis) {
        if (axis === "Y") {
            return el.clientHeight < el.scrollHeight;
        }

        if (axis === "X") {
            return el.clientWidth < el.scrollWidth;
        }
    }

    /**
     * indicates if an element has a scrollable overflow property in the axis
     * @method canOverflow
     * @param {Node} el
     * @param {String} axis
     * @returns {Boolean}
     */
    function canOverflow(el, axis) {
        var overflowValue = w.getComputedStyle(el, null)["overflow" + axis];

        return overflowValue === "auto" || overflowValue === "scroll";
    }

    /**
     * indicates if an element can be scrolled in either axis
     * @method isScrollable
     * @param {Node} el
     * @param {String} axis
     * @returns {Boolean}
     */
    function isScrollable(el) {
        var isScrollableY = hasScrollableSpace(el, "Y") && canOverflow(el, "Y");
        var isScrollableX = hasScrollableSpace(el, "X") && canOverflow(el, "X");

        return isScrollableY || isScrollableX;
    }

    /**
     * finds scrollable parent of an element
     * @method findScrollableParent
     * @param {Node} el
     * @returns {Node} el
     */
    function findScrollableParent(el) {
        while (el !== d.body && isScrollable(el) === false) {
            el = el.parentNode || el.host;
        }

        return el;
    }

    /**
     * self invoked function that, given a context, steps through scrolling
     * @method step
     * @param {Object} context
     * @returns {undefined}
     */
    function step(context) {
        var time = now();
        var value;
        var currentX;
        var currentY;
        var elapsed = (time - context.startTime) / SCROLL_TIME;

        // avoid elapsed times higher than one
        elapsed = elapsed > 1 ? 1 : elapsed;

        // apply easing to elapsed time
        value = ease(elapsed);

        currentX = context.startX + (context.x - context.startX) * value;
        currentY = context.startY + (context.y - context.startY) * value;

        context.method.call(context.scrollable, currentX, currentY);

        // scroll more if we have not reached our destination
        if (currentX !== context.x || currentY !== context.y) {
            w.requestAnimationFrame(step.bind(w, context));
        }
    }

    /**
     * scrolls window or element with a smooth behavior
     * @method smoothScroll
     * @param {Object|Node} el
     * @param {Number} x
     * @param {Number} y
     * @returns {undefined}
     */
    function smoothScroll(el, x, y) {
        var scrollable;
        var startX;
        var startY;
        var method;
        var startTime = now();

        // define scroll context
        if (el === d.body) {
            scrollable = w;
            startX = w.scrollX || w.pageXOffset;
            startY = w.scrollY || w.pageYOffset;
            method = original.scroll;
        } else {
            scrollable = el;
            startX = el.scrollLeft;
            startY = el.scrollTop;
            method = scrollElement;
        }

        // scroll looping over a frame
        step({
            scrollable: scrollable,
            method: method,
            startTime: startTime,
            startX: startX,
            startY: startY,
            x: x,
            y: y,
        });
    }

    // ORIGINAL METHODS OVERRIDES
    // w.scroll and w.scrollTo
    w.scroll = w.scrollTo = function () {
        // avoid action when no arguments are passed
        if (arguments[0] === undefined) {
            return;
        }

        // avoid smooth behavior if not required
        if (shouldBailOut(arguments[0]) === true) {
            original.scroll.call(
                w,
                arguments[0].left !== undefined
                    ? arguments[0].left
                    : typeof arguments[0] !== "object"
                    ? arguments[0]
                    : w.scrollX || w.pageXOffset,
                // use top prop, second argument if present or fallback to scrollY
                arguments[0].top !== undefined
                    ? arguments[0].top
                    : arguments[1] !== undefined
                    ? arguments[1]
                    : w.scrollY || w.pageYOffset
            );

            return;
        }

        // LET THE SMOOTHNESS BEGIN!
        smoothScroll.call(
            w,
            d.body,
            arguments[0].left !== undefined
                ? ~~arguments[0].left
                : w.scrollX || w.pageXOffset,
            arguments[0].top !== undefined
                ? ~~arguments[0].top
                : w.scrollY || w.pageYOffset
        );
    };

    // w.scrollBy
    w.scrollBy = function () {
        // avoid action when no arguments are passed
        if (arguments[0] === undefined) {
            return;
        }

        // avoid smooth behavior if not required
        if (shouldBailOut(arguments[0])) {
            original.scrollBy.call(
                w,
                arguments[0].left !== undefined
                    ? arguments[0].left
                    : typeof arguments[0] !== "object"
                    ? arguments[0]
                    : 0,
                arguments[0].top !== undefined
                    ? arguments[0].top
                    : arguments[1] !== undefined
                    ? arguments[1]
                    : 0
            );

            return;
        }

        // LET THE SMOOTHNESS BEGIN!
        smoothScroll.call(
            w,
            d.body,
            ~~arguments[0].left + (w.scrollX || w.pageXOffset),
            ~~arguments[0].top + (w.scrollY || w.pageYOffset)
        );
    };

    // Element.prototype.scroll and Element.prototype.scrollTo
    Element.prototype.scroll = Element.prototype.scrollTo = function () {
        // avoid action when no arguments are passed
        if (arguments[0] === undefined) {
            return;
        }

        // avoid smooth behavior if not required
        if (shouldBailOut(arguments[0]) === true) {
            // if one number is passed, throw error to match Firefox implementation
            if (
                typeof arguments[0] === "number" &&
                arguments[1] === undefined
            ) {
                throw new SyntaxError("Value could not be converted");
            }

            original.elementScroll.call(
                this,
                // use left prop, first number argument or fallback to scrollLeft
                arguments[0].left !== undefined
                    ? ~~arguments[0].left
                    : typeof arguments[0] !== "object"
                    ? ~~arguments[0]
                    : this.scrollLeft,
                // use top prop, second argument or fallback to scrollTop
                arguments[0].top !== undefined
                    ? ~~arguments[0].top
                    : arguments[1] !== undefined
                    ? ~~arguments[1]
                    : this.scrollTop
            );

            return;
        }

        var left = arguments[0].left;
        var top = arguments[0].top;

        // LET THE SMOOTHNESS BEGIN!
        smoothScroll.call(
            this,
            this,
            typeof left === "undefined" ? this.scrollLeft : ~~left,
            typeof top === "undefined" ? this.scrollTop : ~~top
        );
    };

    // Element.prototype.scrollBy
    Element.prototype.scrollBy = function () {
        // avoid action when no arguments are passed
        if (arguments[0] === undefined) {
            return;
        }

        // avoid smooth behavior if not required
        if (shouldBailOut(arguments[0]) === true) {
            original.elementScroll.call(
                this,
                arguments[0].left !== undefined
                    ? ~~arguments[0].left + this.scrollLeft
                    : ~~arguments[0] + this.scrollLeft,
                arguments[0].top !== undefined
                    ? ~~arguments[0].top + this.scrollTop
                    : ~~arguments[1] + this.scrollTop
            );

            return;
        }

        this.scroll({
            left: ~~arguments[0].left + this.scrollLeft,
            top: ~~arguments[0].top + this.scrollTop,
            behavior: arguments[0].behavior,
        });
    };

    // Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function () {
        // avoid smooth behavior if not required
        if (shouldBailOut(arguments[0]) === true) {
            original.scrollIntoView.call(
                this,
                arguments[0] === undefined ? true : arguments[0]
            );

            return;
        }

        // LET THE SMOOTHNESS BEGIN!
        var scrollableParent = findScrollableParent(this);
        var parentRects = scrollableParent.getBoundingClientRect();
        var clientRects = this.getBoundingClientRect();

        if (scrollableParent !== d.body) {
            // reveal element inside parent
            smoothScroll.call(
                this,
                scrollableParent,
                scrollableParent.scrollLeft +
                    clientRects.left -
                    parentRects.left,
                scrollableParent.scrollTop + clientRects.top - parentRects.top
            );

            // reveal parent in viewport unless is fixed
            if (w.getComputedStyle(scrollableParent).position !== "fixed") {
                w.scrollBy({
                    left: parentRects.left,
                    top: parentRects.top,
                    behavior: "smooth",
                });
            }
        } else {
            // reveal element in viewport
            w.scrollBy({
                left: clientRects.left,
                top: clientRects.top,
                behavior: "smooth",
            });
        }
    };
}

if (typeof exports === "object" && typeof module !== "undefined") {
    // commonjs
    module.exports = { polyfill: polyfill };
} else {
    // global
    polyfill();
}

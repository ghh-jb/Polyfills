/**
 * @ungap/structured-clone - A structuredClone polyfill
 * https://github.com/ungap/structured-clone
 * (c) Andrea Giammarchi - ISC License
 * 
 * Standalone polyfill version - single file for easy inclusion
 */
(function (global) {
    'use strict';

    // Type constants
    const VOID = -1;
    const PRIMITIVE = 0;
    const ARRAY = 1;
    const OBJECT = 2;
    const DATE = 3;
    const REGEXP = 4;
    const MAP = 5;
    const SET = 6;
    const ERROR = 7;
    const BIGINT = 8;

    const EMPTY = '';
    const { toString } = {};
    const { keys } = Object;
    const env = typeof self === 'object' ? self : globalThis;

    // Type detection
    const typeOf = value => {
        const type = typeof value;
        if (type !== 'object' || !value)
            return [PRIMITIVE, type];

        const asString = toString.call(value).slice(8, -1);
        switch (asString) {
            case 'Array':
                return [ARRAY, EMPTY];
            case 'Object':
                return [OBJECT, EMPTY];
            case 'Date':
                return [DATE, EMPTY];
            case 'RegExp':
                return [REGEXP, EMPTY];
            case 'Map':
                return [MAP, EMPTY];
            case 'Set':
                return [SET, EMPTY];
            case 'DataView':
                return [ARRAY, asString];
        }

        if (asString.includes('Array'))
            return [ARRAY, asString];

        if (asString.includes('Error'))
            return [ERROR, asString];

        return [OBJECT, asString];
    };

    const shouldSkip = ([TYPE, type]) => (
        TYPE === PRIMITIVE &&
        (type === 'function' || type === 'symbol')
    );

    // Serializer
    const serializer = (strict, json, $, _) => {
        const as = (out, value) => {
            const index = _.push(out) - 1;
            $.set(value, index);
            return index;
        };

        const pair = value => {
            if ($.has(value))
                return $.get(value);

            let [TYPE, type] = typeOf(value);
            switch (TYPE) {
                case PRIMITIVE: {
                    let entry = value;
                    switch (type) {
                        case 'bigint':
                            TYPE = BIGINT;
                            entry = value.toString();
                            break;
                        case 'function':
                        case 'symbol':
                            if (strict)
                                throw new TypeError('unable to serialize ' + type);
                            entry = null;
                            break;
                        case 'undefined':
                            return as([VOID], value);
                    }
                    return as([TYPE, entry], value);
                }
                case ARRAY: {
                    if (type) {
                        let spread = value;
                        if (type === 'DataView') {
                            spread = new Uint8Array(value.buffer);
                        }
                        else if (type === 'ArrayBuffer') {
                            spread = new Uint8Array(value);
                        }
                        return as([type, [...spread]], value);
                    }

                    const arr = [];
                    const index = as([TYPE, arr], value);
                    for (const entry of value)
                        arr.push(pair(entry));
                    return index;
                }
                case OBJECT: {
                    if (type) {
                        switch (type) {
                            case 'BigInt':
                                return as([type, value.toString()], value);
                            case 'Boolean':
                            case 'Number':
                            case 'String':
                                return as([type, value.valueOf()], value);
                        }
                    }

                    if (json && ('toJSON' in value))
                        return pair(value.toJSON());

                    const entries = [];
                    const index = as([TYPE, entries], value);
                    for (const key of keys(value)) {
                        if (strict || !shouldSkip(typeOf(value[key])))
                            entries.push([pair(key), pair(value[key])]);
                    }
                    return index;
                }
                case DATE:
                    return as([TYPE, value.toISOString()], value);
                case REGEXP: {
                    const { source, flags } = value;
                    return as([TYPE, { source, flags }], value);
                }
                case MAP: {
                    const entries = [];
                    const index = as([TYPE, entries], value);
                    for (const [key, entry] of value) {
                        if (strict || !(shouldSkip(typeOf(key)) || shouldSkip(typeOf(entry))))
                            entries.push([pair(key), pair(entry)]);
                    }
                    return index;
                }
                case SET: {
                    const entries = [];
                    const index = as([TYPE, entries], value);
                    for (const entry of value) {
                        if (strict || !shouldSkip(typeOf(entry)))
                            entries.push(pair(entry));
                    }
                    return index;
                }
            }

            const { message } = value;
            return as([TYPE, { name: type, message }], value);
        };

        return pair;
    };

    // Serialize function
    const serialize = (value, { json, lossy } = {}) => {
        const _ = [];
        return serializer(!(json || lossy), !!json, new Map, _)(value), _;
    };

    // Deserializer
    const deserializer = ($, _) => {
        const as = (out, index) => {
            $.set(index, out);
            return out;
        };

        const unpair = index => {
            if ($.has(index))
                return $.get(index);

            const [type, value] = _[index];
            switch (type) {
                case PRIMITIVE:
                case VOID:
                    return as(value, index);
                case ARRAY: {
                    const arr = as([], index);
                    for (const index of value)
                        arr.push(unpair(index));
                    return arr;
                }
                case OBJECT: {
                    const object = as({}, index);
                    for (const [key, index] of value)
                        object[unpair(key)] = unpair(index);
                    return object;
                }
                case DATE:
                    return as(new Date(value), index);
                case REGEXP: {
                    const { source, flags } = value;
                    return as(new RegExp(source, flags), index);
                }
                case MAP: {
                    const map = as(new Map, index);
                    for (const [key, index] of value)
                        map.set(unpair(key), unpair(index));
                    return map;
                }
                case SET: {
                    const set = as(new Set, index);
                    for (const index of value)
                        set.add(unpair(index));
                    return set;
                }
                case ERROR: {
                    const { name, message } = value;
                    return as(new env[name](message), index);
                }
                case BIGINT:
                    return as(BigInt(value), index);
                case 'BigInt':
                    return as(Object(BigInt(value)), index);
                case 'ArrayBuffer':
                    return as(new Uint8Array(value).buffer, value);
                case 'DataView': {
                    const { buffer } = new Uint8Array(value);
                    return as(new DataView(buffer), value);
                }
            }
            return as(new env[type](value), index);
        };

        return unpair;
    };

    // Deserialize function
    const deserialize = serialized => deserializer(new Map, serialized)(0);

    // Main structuredClone polyfill
    const structuredClone = typeof global.structuredClone === "function" ?
        (any, options) => (
            options && ('json' in options || 'lossy' in options) ?
                deserialize(serialize(any, options)) : global.structuredClone(any)
        ) :
        (any, options) => deserialize(serialize(any, options));

    // JSON-compatible parse and stringify (with lossy mode)
    const { parse: $parse, stringify: $stringify } = JSON;
    const jsonOptions = { json: true, lossy: true };

    const parseJSON = str => deserialize($parse(str));
    const stringifyJSON = any => $stringify(serialize(any, jsonOptions));

    // Export based on environment
    if (typeof module !== 'undefined' && typeof exports !== 'undefined') {
        // CommonJS
        module.exports = structuredClone;
        module.exports.default = structuredClone;
        module.exports.serialize = serialize;
        module.exports.deserialize = deserialize;
        module.exports.parse = parseJSON;
        module.exports.stringify = stringifyJSON;
    } else {
        // Browser global or polyfill
        if (!global.structuredClone) {
            global.structuredClone = structuredClone;
        }

        // Also expose as StructuredClone namespace for explicit access
        global.StructuredClone = {
            structuredClone: structuredClone,
            serialize: serialize,
            deserialize: deserialize,
            parse: parseJSON,
            stringify: stringifyJSON
        };
    }

})(typeof globalThis !== 'undefined' ? globalThis :
    typeof window !== 'undefined' ? window :
        typeof global !== 'undefined' ? global :
            typeof self !== 'undefined' ? self : this);

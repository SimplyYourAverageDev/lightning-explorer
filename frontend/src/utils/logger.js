// Logger utility to gate console logging in production
export const debug = process.env.NODE_ENV !== 'production';

export const log = (...args) => { 
    if (debug) console.log(...args); 
};

export const warn = (...args) => { 
    if (debug) console.warn(...args); 
};

export const error = (...args) => { 
    if (debug) console.error(...args); 
};

export const time = (label) => { 
    if (debug) console.time(label); 
};

export const timeEnd = (label) => { 
    if (debug) console.timeEnd(label); 
};

export const group = (label) => { 
    if (debug) console.group(label); 
};

export const groupEnd = () => { 
    if (debug) console.groupEnd(); 
}; 
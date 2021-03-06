// tiny jQuery replacement
export async function AJAX(
    url: string,
    method: string,
    data?: string | { [key: string]: string },
    header: { [key: string]: string } = {}
): Promise<string> {
    const xhr = new XMLHttpRequest();
    let resolve: (val?: string) => void;
    let reject: (val?: any) => void;
    const pm = new Promise((_resolve, _reject) => {
        resolve = _resolve;
        reject = _reject;
    });
    if (!xhr) reject(new Error("No AJAX support"));

    xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            (xhr.status === 200) ? resolve(xhr.responseText) : reject(new Error("AJAX fail"));
        }
    };
    Object.keys(header).forEach(k => {
        xhr.setRequestHeader(k, header[k]);
    });
    xhr.open(method, url);
    if (data === undefined) xhr.send();
    else {
        const params = typeof data === "string" ?
            data :
            Object.keys(data)
                .map(k => encodeURIComponent(k) + "=" + encodeURIComponent(data[k]))
                .join("&");
        xhr.send(params);
    }
    return pm as Promise<string>;
}

/**
 * HTTP GET
 * @param url URL to get
 */
export async function GET(url: string): Promise<string> {
    return AJAX(url, "GET");
}

/**
 * HTTP POST
 * @param url URL to post
 * @param data Data to post
 */
export async function POST(url: string, data?: string | { [key: string]: string }): Promise<string> {
    return AJAX(url, "POST", data);
}

/**
 * Shortened querySelector
 * @param str Selector
 */
export function getElem(str: string): HTMLElement {
    return document.querySelector(str);
}

/**
 * Shortened querySelectorAll
 * @param selector Selector
 */
export function getElems(selector: string): HTMLElement[] {
    return [].slice.call(document.querySelectorAll(selector));
}

export function createElem(
    tagName: string,
    id?: string,
    klass?: string[],
    attr: { [key: string]: string } = {}
): HTMLElement {
    const ret = document.createElement(tagName);
    if (id) ret.id = id;
    if (klass) ret.className = klass.join(" ");
    Object.keys(attr).forEach(c => ret.setAttribute(c, attr[c]));
    return ret;
}

export function removeThisListener(e: Event, f: (e?: Event) => void) {
    e.target.removeEventListener(e.type, f);
}

// some tools
export function ParseHTML(str: string): HTMLElement {
    return new DOMParser()
        .parseFromString(str, "text/html")
        .body;
}

export function ParseXML(str: string): Element {
    return new DOMParser()
        .parseFromString(str, "text/xml")
        .children[0];
}


export function HTMLEscape(str: string): string {
    const map: {
        [ch: string]: string
    } = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#039;"
    };
    return str.replace(/[&<>"']/g, m => map[m]);
}

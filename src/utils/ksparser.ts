/// <reference path="./parser.d.ts" />

// KAG Script parser
import { AutoType } from "./util";

/**
 * @class KSParser
 */
export default class KSParser {
    /**
     * KS script to KS 'AST'
     * @public
     * @param str KS script string to parse
     * @return KS AST
     */
    static parse(text: string) {
        function cutfunc(str: string) {
            let depth = 0;
            let cur = "";
            const ret: string[] = [];
            let rawstr = true;
            let funcstr = "";
            for (const ch of str) {
                cur += ch;
                switch (ch) {
                    case "[":
                        if (funcstr.length > 0) ret.push(funcstr);
                        rawstr = false;
                        depth++;
                        break;
                    case "]":
                        rawstr = true;
                        funcstr = "";
                        depth--;
                        if (depth === 0) {
                            ret.push(cur);
                            cur = "";
                        }
                        break;
                    default:
                        if (rawstr) funcstr += ch;
                        break;
                }
            }
            if (funcstr.length > 0) ret.push(funcstr);
            return ret;
        }
        function textline(text: string) {
            const ret: KSLine = {
                type: "text",
                name: undefined,
                display: undefined,
                text: undefined
            };

            // have name
            if (text.indexOf("【") === 0) {
                const fname = text.split("】")[0].replace("【", "").trim();
                ret.text = text.split("】")[1].trim();

                // need rewrite name
                if (fname.indexOf("/") >= 0) {
                    ret.name = fname.split("/")[0];
                    ret.display = fname.split("/")[1];
                }
                else {
                    ret.name = fname;
                }
            }
            else {
                ret.text = text;
            }
            return ret;
        }
        function funcline(text: string) {
            let _text: string;
            let currentPosition = 0;
            let currentChar = " ";
            const seprator = "\"\\+-*/\f\n\r\t '%[]:=><{},?";
            function error(message?: string) {
                throw new SyntaxError(message + ` at ${currentPosition}, char '${currentChar}'`);
            }
            function next(char?: string) {
                if (char && char !== currentChar) {
                    error(`Expected ${char}`);
                }
                currentChar = _text.charAt(currentPosition);
                currentPosition++;
                return currentChar;
            }
            function white() {
                while (currentChar && currentChar <= " ") next();
            }
            function keyvalue() {
                const ret: {
                    key: string,
                    value: JSONObject,
                    haveValue: boolean
                } = {
                    key: undefined,
                    value: undefined,
                    haveValue: false
                };
                white();
                ret.key = ident();
                white();
                if (currentChar === "=") {
                    ret.haveValue = true;
                    let r;
                    if (next() <= " ") white();
                    switch (currentChar as string) {
                        case "\"":
                        case "'":
                            r = str();
                            break;
                        default:
                            r = ident();
                            break;
                    }
                    ret.value = AutoType(r);
                }
                return ret;
            }
            function str() {
                let value = "";
                // When parsing for string values, we must look for " and \ characters.
                const charsep = currentChar;
                if (charsep !== "'" && charsep !== "\"") {
                    white();
                    do {
                        if (seprator.includes(currentChar)) break;
                        value += currentChar;
                    } while (next());
                    if (value.length === 0) error(`Empty colonless string`);
                    else return value;
                }
                while (next()) {
                    if (currentChar === charsep) {
                        next();
                        return value;
                    }
                    value += currentChar;
                }
                error(`Bad string`);
            }
            function ident() {
                let value = "";
                white();
                do {
                    if (seprator.includes(currentChar)) break;
                    value += currentChar;
                } while (next());
                // currentPosition--;
                // if (value.length === 0) error(`Empty identifier string`);
                /*else*/ return value;
            }
            function parse(text: string) {
                _text = text.substr(1, text.length - 2).trim();
                if (_text.length === 0) error(`too short, ${text}`);
                currentPosition = 0;
                white();
                const ret: KSLine = {
                    type: "func",
                    name: ident(),
                    option: [],
                    param: {}
                };
                const temp = [];
                // jup over 1st space
                while (currentPosition < _text.length) {
                    white();
                    if (temp.length > 100) {
                        error("Too long");
                    }
                    temp.push(keyvalue());
                }

                const fparam = temp.filter(p => p.haveValue);
                const fopt = temp.filter(p => !p.haveValue);

                fparam.forEach(p => ret.param[p.key] = p.value);
                ret.option = fopt.map(p => p.key);
                return ret;
            }
            return parse(text);
        }
        const lines: string[] = [];
        // scan1, check line type
        text.split("\n").forEach(l => {
            l = l.trim();
            switch (l[0]) {
                case ";":   // ignore coments
                    return;
                case "[":   // cut to multiple function token
                    lines.push(...cutfunc(l));
                    return;
                case "*":   // tag
                    lines.push(l);
                    return;
                default:    // text
                    lines.push(l);
                    return;
            }
        });
        // scan2, generate objects
        return lines.map(c => {
            c = c.trim();
            switch (c[0]) {
                case ";": // ignore comment line
                    return undefined;
                case "[": // type:func
                    return funcline(c);
                case "*": // type:entry *tag|comment
                    const tag = c.substr(1).trim().split("|")[0];
                    if (tag) return { type: "entry", name: tag };
                    else return undefined;
                default: // type:text
                    if (c) return textline(c);
                    else return undefined;
            }
        }).filter(c => c !== undefined);
    }

    /**
     * KS script to KS 'AST'
     * @public
     * @param obj KS AST
     * @return script string
     */
    static stringify(obj: [KSLine]) {
        return obj.reduce((str, line) => {
            let l;
            switch (line.type) {
                case "entry":
                    l = "*" + line.name;
                    break;
                case "text":
                    let _name = "";
                    if (line.name !== undefined) {
                        _name = line.name;
                        if (line.display !== undefined) _name += ("/" + line.display);
                        _name = `【${_name}】`;
                    }
                    l = _name + line.text;
                    break;
                case "func":
                    const optstr = line.option.join(" ");
                    const paramstr = Object.keys(line.param)
                        .map(p => `${p}=${line.param[p]}`)
                        .join(" ");

                    const ls = [line.name];
                    if (optstr) ls.push(optstr);
                    if (paramstr) ls.push(paramstr);
                    l = `[${ls.join(" ")}]`;
                    break;
                default:
                    l = "";
                    break;
            }
            return str + l + "\n";
        }, "");
    }
}

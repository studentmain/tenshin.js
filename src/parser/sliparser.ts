interface RawSLI { [key: string]: string; }
export default class SLIParser {
    static readonly GENERATOR_INFO =
        "#2.00\n" +
        "# Sound Loop Information (utf-8)\n" +
        "# Generated by sliparser.ts from tenshin.js project\n";

    /**
     * Parse a SLI file
     * @param str String to parse
     */
    static parse(str: string) {
        let currentPosition = 0;
        let currentChar = " ";
        let text = "";
        const esc = "{}=;";
        function error(message?: string) {
            throw new SyntaxError(message + ` at ${currentPosition}, char ${currentChar}, string ${text}`);
        }
        function preprocess(s: string): string {
            return s
                .split("\n")                        // split to line
                .map(l => l.replace(/#.*$/, ""))    // remove line comment
                .join("")                           // back to string
                .replace(/([{}=;])/g, " $1 ")       // add missing space
                .replace(/\s+/g, " ")               // remove unnecessary space
                .trim();
        }
        function next(char?: string) {
            if (char && char !== currentChar) {
                error(`Expected ${char}`);
            }
            currentChar = text.charAt(currentPosition);
            currentPosition++;
            return currentChar;
        }
        function white() {
            while (currentChar && currentChar <= " ") next();
            // currentPosition--;
            // currentChar = text.charAt(currentPosition);
        }
        function lines(): RawSLI[] {
            const r: RawSLI[] = [];
            while (true) {
                const t = strToken().toLowerCase();
                if (t === "") break;
                white();
                next("{");
                const kv = kvpairs();
                kv.type = t;
                r.push(kv);
                next("}");
            }
            return r;
        }
        function kvpairs() {
            const ret: RawSLI = {};
            while (true) {
                const k = strToken().toLowerCase();
                if (k === "") break;
                white();
                next("=");
                const v = strToken();
                ret[k] = v;
                white();
                next(";");
            }
            return ret;
        }
        function strToken(): string {
            white();
            currentPosition--;
            let buf = "";
            while (true) {
                next();
                if (currentChar <= " " || esc.includes(currentChar)) break;
                buf += currentChar;
            }
            return buf;
        }
        function typeConv(sli: RawSLI[]): SoundLoopInfo[] {
            return sli.map(i => {
                switch (i.type) {
                    case "label":
                        return {
                            type: "label",
                            name: i.name.replace(/^["']|["']$/g, ""),
                            position: parseInt(i.position)
                        } as SLILabel;
                    case "link":
                        return {
                            type: "link",
                            condition: i.condition === "no" ? "" : i.condition,
                            condvar: parseInt(i.condvar),
                            from: parseInt(i.from),
                            refvalue: parseInt(i.refvalue),
                            smooth: i.smooth.toLowerCase() !== "false",
                            to: parseInt(i.to),
                        } as SLILink;
                    default:
                        return undefined;
                }
            }).filter(i => i);
        }
        text = preprocess(str);
        return typeConv(lines());
    }

    /**
     * SLI info to string
     * @param sli parsed SLI info
     * @param banner Optional geneartor info banner, if == "", use default one
     */
    static stringify(sli: SoundLoopInfo[], banner?: string): string {
        return banner || this.GENERATOR_INFO + sli.map(i => {
            switch (i.type) {
                case "label":
                    return `Label { Position=${i.position}; Name="${i.name}";}`;
                case "link":
                    const smoothstr = i.smooth ? "True" : "False";
                    const conditionstr = i.condition ? i.condition : "no";
                    return `Link { From=${i.from}; To=${i.to}; Smooth=${smoothstr}; Condition=${conditionstr}; RefValue=${i.refvalue}; CondVar=${i.condvar};}`;
            }
        }).join("\n");
    }
}
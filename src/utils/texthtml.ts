import KSParser from "./ksparser";
/**
 * convert text with ks format cmd to html
 * @param {String} txt Text with KAG tag
 * @returns {String} KAG tag converted to html tag
 */
export default function TextHTML(txt: string) {
    if (txt.indexOf('[') < 0) return txt;
    // first, cut to lines: text\n[cmd]\ntext
    const t = txt
        .replace(/\[/g, '\n[')
        .replace(/\]/g, ']\n')
        .split('\n');
    // generate raw text and cmd position
    let rs = "";
    // use KSParser to parse function
    let c: [number, KSLine][] = [];
    t.forEach(e => {
        if (e[0] == '[') {
            let f = KSParser.parse(e)[0];
            c.push([rs.length, f])
        }
        else {
            rs += e;
        }
    })
    let p = 0;
    let ret = "";
    c.forEach(t => {
        let f: KSLine;
        // append unformatted txt
        ret += rs.substr(p, t[0] - p);
        [p, f] = t;
        switch (f.name) {
            case 'ruby': // [ruby text='text']c
                ret += '<ruby>';
                ret += rs[p];
                p++;
                ret += '<rt>';
                ret += f.param.text;
                ret += '</rt></ruby>';
                break;
            case 'r':  // [r]
                ret += '<br />';
                break;
            default:
                console.warn("TextHTML, Unknown inline tag", t);
                break;
        }
    });
    ret += rs.substr(p);
    return ret;
}
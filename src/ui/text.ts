import { getElem } from "../utils/dom";
import TextHTML from "../parser/texthtml";

export default class TextUI {
    static nameCh: HTMLElement;
    static textCh: HTMLElement;
    static Init() {
        this.nameCh = getElem("#charname");
        this.textCh = getElem("#chartxt");
    }

    static Print(text: string, display: string) {
        display = display || "";
        this.nameCh.innerHTML = display;
        this.textCh.innerHTML = TextHTML(text);
    }
}

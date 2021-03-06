import SLIParser from "./sliparser";

test("empty", () => {
    expect(SLIParser.parse("")).toEqual([]);
});

test("parse without comment", () => {
    expect(SLIParser.parse("Label { Position=264192; Name='start'; }")).toEqual(
        [{
            name: "start",
            position: 264192,
            type: "label",
        }]);
});

test("parse with no space and extra \\n", () => {
    expect(SLIParser.parse("Label{Position=264192;\nName='start';}")).toEqual(
        [{
            name: "start",
            position: 264192,
            type: "label",
        }]);
});

test("parse with comment", () => {
    expect(SLIParser.parse(`#2.00
    # Sound Loop Information (utf-8)
    # Generated by WaveLoopManager.cpp
    Link { From=8732864;          To=3440864;          Smooth=False; Condition=no; RefValue=0;          CondVar=0;  }
    Label { Position=264192;           Name='start';                                     }
    `)).toEqual([
        {
            condition: "",
            condvar: 0,
            from: 8732864,
            refvalue: 0,
            smooth: false,
            to: 3440864,
            type: "link"
        },
        {
            name: "start",
            position: 264192,
            type: "label"
        }
    ]);
});
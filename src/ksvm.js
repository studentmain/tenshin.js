import { Runtime } from "./runtime";

// when to hang up vm
let VM_STEP = 0;
let VM_SCENE = 1;
let VM_SELECT = 2;
let VM_NEVER = 3;
// vm display mode
let VM_NORMAL = 0; // standard mode
let VM_AUTO = 1; // wait for voice end
let VM_QUICK = 2; // fixed interval
let VM_NONE = 3; // no output

export class KSVM {

    constructor(runtime) {
        this.runtime = runtime;
        runtime.vm = this;
        this.runmode = VM_SCENE;
        this.dispmode = VM_NORMAL;
        this.hang = false;
        // scripts = {name: script}
        this.scripts = {};
        this.tags = {};
        // [script name, line#]
        this.currentpos = { "script": null, "line": 1 };

        this.posstack = [];
        this.runlock = false;
    }

    AddScript(name, script) {
        this.scripts[name] = script;
        // scan tags
        var lineno = 0;
        for (const s of script) {
            if (s.type == "entry") {
                if (this.tags[s.name] === undefined) this.tags[s.name] = [];
                this.tags[s.name].push({ "script": name, "line": lineno });
            }
            lineno++;
        }
    }

    LocateTag(tag, script) {
        const ts = this.tags[tag.substr(1)];
        if (script === undefined) return ts[0];
        else {
            for (const t of ts) {
                if (t.script == script.split('.')[0]) return t;
            }
        }
        return undefined;
    }

    // .
    Next() {
        this.runmode = VM_SCENE;
        this.dispmode = VM_NORMAL;
        this.hang = false;
        this.Run();
    }

    // >
    Auto() {
        this.runmode = VM_SELECT;
        this.dispmode = VM_AUTO;
        this.hang = false;
        this.Run();
    }

    // debug only
    Step() {
        this.runmode = VM_STEP;
        this.dispmode = VM_NORMAL;
        this.hang = false;
        this.Run();
    }

    // >> 
    Jump() {
        this.runmode = VM_NEVER;
        this.dispmode = VM_QUICK;
        this.hang = false;
        this.Run();
    }

    // >|
    NextSelect() {
        this.runmode = VM_SCENE;
        this.dispmode = VM_NONE;
        this.hang = false;
        this.Run();
    }

    // <
    BackLog() {

    }

    // <<
    Back() {

    }

    // |<
    LastSelect() {

    }

    // main entry
    Run() {
        if (this.runlock) return;
        this.runlock = true;
        while (!this.hang) {
            if (this.currentpos.line >= this.scripts[this.currentpos.script].length) {
                // too far
                this.hang = true;
                console.log("EOF");
                return;
            }
            const cmd = this.CurrentCmd();
            switch (cmd.type) {
                case "entry":
                    break;
                // begintrans = start transframe compile
                // about transframe mechanism:
                // begintrans
                // animation sequence
                // endtrans
                // text (play animation here)
                // let rtlib handle them
                case "func":
                    switch (cmd.name) {
                        case "next":
                            console.log('Try jump from', this.currentpos);
                            if (cmd.param.eval != undefined) {
                                // tjs eval
                                var r = this.runtime.TJSeval(cmd.param.eval);
                                if (!r) {
                                    console.log('Cancelled');
                                    break;
                                }
                                console.log('Confirmed');
                            }
                            if (cmd.param.target == undefined) {
                                this.currentpos = { "script": cmd.param.storage.split('.')[0], "line": 0 };
                            }
                            else {
                                this.currentpos = this.LocateTag(cmd.param.target, cmd.param.storage);
                            }
                            console.log('To', this.currentpos, this.CurrentCmd());
                            break;
                        case "mseladd":
                            this.runtime.MapSelectAdd(cmd);
                            break;
                        case "seladd":
                            this.runtime.SelectAdd(cmd);
                            break;
                        case "mselect":
                            var next = this.runtime.MapSelect();
                            console.log("Map select, then jump to", next);
                            if (next !== undefined) {
                                if (next[0] !== undefined) {
                                    this.currentpos = this.LocateTag(next[0], next[1]);
                                }
                            }
                            break;
                        case "select":
                            var next = this.runtime.Select();
                            console.log("Select, then jump to", this.currentpos);
                            if (next !== undefined) {
                                if (next[0] !== undefined) {
                                    this.currentpos = this.LocateTag(next[0], next[1]);
                                }
                            }
                            break;
                        case "sysjump":
                            // special handling
                            console.log("finished");
                            break;
                        case "eval":
                            this.runtime.TJSeval(cmd.param.exp);
                            break;
                        default:
                            //console.log(this.currentpos, cmd);
                            break;
                    }
                    break;
                case "text":
                    // console.log(cmd);
                    this.runtime.Text(cmd);
                    if (this.runmode == VM_SCENE) this.hang = true;
                    break;
            }
            this.currentpos.line++;
        }
        this.runlock = false;
    }

    CurrentCmd() {
        return this.scripts[this.currentpos.script][this.currentpos.line]
    }

    // run from *tag, used for playback
    RunFrom(tag) {
        this.currentpos = this.tags[tag][0];
        this.Run();
    }

    // save internal status
    Save() {

    }

    // load
    Load(status) {

    }
}
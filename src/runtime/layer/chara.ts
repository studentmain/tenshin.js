import ObjectMapper from "../../objectmapper";
import TextUI from "../../ui/text";
import FilePath from "../../utils/filepath";
import KRCSV from "../../parser/krcsv";
import Sound from "../sound";
import LayerBase from "./base";

enum KAGConst {
    Both = "KAGEnvImage.BOTH",      // 出
    BU = "KAGEnvImage.BU",          // 立
    Clear = "KAGEnvImage.CLEAR",    // 消
    Face = "KAGEnvImage.FACE",      // 顔
    Invisible = "KAGEnvImage.INVISIBLE",    // 無 (unused)
    DispPosition = "KAGEnvironment.DISPPOSITION",
    XPosition = "KAGEnvironment.XPOSITION",
    Level = "KAGEnvironment.LEVEL"
}

interface LayerCharaDress {
    [dressname: string]: {          // 制服春
        [subvariant: string]: {     // 1
            name: string;           // 制服春ポーズＡ（腕差分）
            prefix: string;         // ポーズa
        }
    };
}
interface LayerCharaFace {
    [variant: string]: {            // ポーズa
        [faceid: string]: string[]; // 51 -> [通常１,頬染め]
    };
}
interface LayerCharaCoord {
    [variant: string]: {                    // ポーズa
        [subvariant: string]: {             // 1
            [layername: string]: LayerInfo  // 顔領域
        }
    };
}

export default class LayerChara extends LayerBase {
    readonly zindex = 20;
    static voiceBase = "";
    private name: string;
    private currentVoice = 1;
    private nextVoice: string;
    private voiceFmt: string;
    private displayName: string;

    dress: LayerCharaDress = {};
    face: LayerCharaFace = {};
    coord: LayerCharaCoord = {};
    imageLevel = 1;
    imageXPos = 0;
    dispPos: string = KAGConst.Both;
    showedInDom = false;
    dressOpt = "";

    static characters: {
        [name: string]: LayerChara
    } = {};
    static Init() {
        Object.keys(ObjectMapper.innerobj.characters)
            .forEach(c => new LayerChara(c));
    }
    static GetInstance(cmd?: KSFunc): LayerChara {
        return this.characters[cmd.name];
    }
    constructor(name?: string) {
        super();
        this.name = name;
        this.currentVoice = 1;
        this.voiceFmt = ObjectMapper.GetProperty(name).voiceFile;
        this.displayName = ObjectMapper.GetProperty(name).standName;

        LayerChara.characters[name] = this;
        // if character has no image, skip image meta
        const fgLs = FilePath.ls(`${Config.Display.CharacterPath}/${name}`);
        if (fgLs !== undefined) this.__LoadImageInfo(fgLs);
    }

    async __LoadImageInfo(fileList: IndexItem) {
        const files = Object.keys(fileList);
        // load all data, limit rate here, or it will block pipe
        files.filter(f => f.match(/info\.txt$/)).forEach(f => this.__LoadChunk(f));
        files.filter(f => f.match(/[0-9]\.txt$/)).forEach(f => this.__LoadCoord(f));
    }
    async __LoadChunk(chunkFileName: string) {
        const chunkDefs = KRCSV.parse(await FilePath.read(chunkFileName), "\t", false);
        const _fsp = chunkFileName.split("_");
        const pfx = _fsp.slice(0, _fsp.length - 1).join("_");
        if (this.face[pfx] === undefined) {
            this.face[pfx] = {};
        }
        chunkDefs.filter(def => def.length === 5).forEach(def => {
            const [, dname, , dno, dvstr] = def;
            if (this.dress[dname] === undefined) {
                this.dress[dname] = {};
            }
            this.dress[dname][dno] = { name: dvstr, prefix: pfx };
        });
        chunkDefs.filter(def => def.length === 4).forEach(def => {
            const [, fno, , fvstr] = def;
            if (this.face[pfx][fno] === undefined) {
                this.face[pfx][fno] = [];
            }
            this.face[pfx][fno].push(fvstr);
        });
    }
    async __LoadCoord(coordFileName: string) {
        const coordDefs = KRCSV.parse(await FilePath.read(coordFileName), "\t");
        const fvar = coordFileName.match(/_([0-9])\./)[1];
        const _fsp = coordFileName.split("_");
        const pfx = _fsp.slice(0, _fsp.length - 1).join("_");
        if (this.coord[pfx] === undefined) {
            this.coord[pfx] = {};
        }
        if (this.coord[pfx][fvar] === undefined) {
            this.coord[pfx][fvar] = {};
        }
        coordDefs.forEach(def => {
            const [, lname, loffx, loffy, lsizex, lsizey, , , , lid] = def;
            this.coord[pfx][fvar][lname] = {
                // type sensitive
                offset: { x: parseInt(loffx), y: parseInt(loffy) },
                size: { x: parseInt(lsizex), y: parseInt(lsizey) },
                name: lid
            };
        });
    }

    /**
     * CalculateSubLayer, had side effect
     * @param cmd command
     */
    CalculateSubLayer(cmd: KSFunc): LayerInfo[] {
        const { name, option, param } = cmd;
        if (name !== this.name) return;
        // let upper runtime handle this, it's public option
        if (param.delayrun) return;
        // first, voice option:
        if (param.voice) {
            if (!isNaN(parseInt(param.voice))) {
                this.currentVoice = parseInt(param.voice);
            }
            else {
                this.nextVoice = param.voice;
            }
        }
        const ret = this.ProcessImageCmd(cmd.option);
        if (!ret) debugger;
        return ret;
    }

    CalculateShowHide(cmd: KSFunc): boolean {
        const { name, option, param } = cmd;
        let needShow = super.CalculateShowHide(cmd);
        const mapped = ObjectMapper.ConvertAll(option);
        const mapShowOpt = ((mapped.positions || [])
            .filter((p: any) => p.disp !== undefined)
            .map((p: any) => p.disp)[0])
            || undefined;

        let mapShow;
        if (mapShowOpt !== undefined) {
            if ([KAGConst.Both, KAGConst.BU].includes(mapShowOpt)) mapShow = true;
            /* else if (mapShowOpt === KAGConst.Clear) {
                // not so clear
                if (this.dispPos === KAGConst.Both) mapShow = true;
                else mapShow = false; // should = !lastState
            } */
            else mapShow = false;
            this.dispPos = mapShowOpt;
        }
        needShow = (mapShow !== undefined) ? mapShow : needShow;
        if (needShow === undefined) needShow = this.showedInDom;
        else this.showedInDom = needShow;
        return needShow;
    }

    CalculateName(cmd: KSFunc): string {
        return this.name;
    }
    CalculateZoom(cmd: KSFunc): number {
        this.RefreshImageLevel(cmd.option);
        const fix = [3500 / 50, 100, 7500 / 100, 100, 12000 / 140, 100][this.imageLevel];
        return fix;
    }

    private ProcessImageCmd(option: string[]): LayerInfo[] {
        if (this.displayName && this.displayName !== this.name) {
            LayerChara.GetInstance({ name: this.displayName } as KSFunc).ProcessImageCmd(option);
        }
        const usedVer = this.RefreshImageLevel(option);
        const allDress = Object.keys(this.dress);
        const dOpt = option.filter(o => allDress.includes(o))[0];
        if (dOpt) {
            this.dressOpt = dOpt;
        }
        const fOpt = option.filter(o => o.match(/^[0-9]{3}$/) !== null)[0];
        let imgctl: LayerInfo[] = [];
        if (fOpt) {
            // select image
            const mainId = fOpt.substr(0, 1);
            const varId = fOpt.substr(1, 2).match(/([1-9][0-9]?)/)[1];

            if (!this.dressOpt) this.dressOpt = Object.keys(this.dress)[0];
            const { name: mainImg, prefix: pfx } = this.dress[this.dressOpt][mainId];
            const varImg = this.face[pfx][varId];
            if (varImg === undefined) return;
            const vImgs: LayerInfo[] = varImg
                .map(v => this.coord[pfx][usedVer][v]);
            const mImg = this.coord[pfx][usedVer][mainImg];
            imgctl = ([mImg] as LayerInfo[]).concat(vImgs)
                // transform names
                .map(v => ({
                    name: ([pfx, usedVer, v.name].join("_")),
                    offset: v.offset,
                    size: v.size,
                }));
        }
        return imgctl;
    }

    private RefreshImageLevel(option: string[]) {
        const mapped = ObjectMapper.ConvertAll(option);
        (mapped.positions || []).forEach((p: any) => {
            if (p.type === KAGConst.Level) this.imageLevel = parseInt(p.level);
        });
        // 35 50 75 100 120 140 bgexpand original
        // WATCHOUT! Magic here!
        return ([1, 1, 3, 3, 5, 5, 3])[this.imageLevel];
    }

    CalculatePosition(cmd: KSFunc): Point {
        const level = this.RefreshImageLevel(cmd.option);
        const size = this.CalculateSize(cmd);
        // 35 50 75 100 120 140 _ _
        const fix = [300, 400, 200, 300, 200, 200, 0, 0][this.imageLevel]; // WATCHOUT! Magic here!
        const xrate = [0.5, 0.75, 1, 1.33, 1.5, 2][this.imageLevel];    // x coord scale rate
        const r = super.CalculatePositionWithPZoom(cmd, xrate);
        r.y = r.y || 0 + fix;
        return r;
    }

    CalculateSize(cmd: KSFunc): Point {
        const option = cmd.option;
        if (this.displayName && this.displayName !== this.name) {
            LayerChara.GetInstance({ name: this.displayName } as KSFunc).ProcessImageCmd(option);
        }
        const usedVer = this.RefreshImageLevel(option);
        const allDress = Object.keys(this.dress);
        const dOpt = option.filter(o => allDress.includes(o))[0];
        if (dOpt) {
            this.dressOpt = dOpt;
        }
        const fOpt = option.filter(o => o.match(/^[0-9]{3}$/) !== null)[0];
        if (fOpt) {
            // select image
            const mainId = fOpt.substr(0, 1);
            if (!this.dressOpt) this.dressOpt = Object.keys(this.dress)[0];
            const pfx = this.dress[this.dressOpt][mainId].prefix;
            // the 'undefined' here is a magic
            // in original text file, size line has empty layer name
            return this.coord[pfx][usedVer].undefined.size;
        }
        return;
    }

    CalculateZoomCenter(cmd: KSFunc): Point {
        const level = this.RefreshImageLevel(cmd.option);
        const fix = [0, 50, 0, 70, 0, 80][level]; // WATCHOUT! Another magic here!
        return { x: 50, y: fix };
    }

    Text(text: string, displayName: string) {
        // display name haven't been rewrite, need set
        if (!displayName) {
            if (this.displayName) displayName = this.displayName;
            else displayName = this.name;
        }
        this.Voice();
        TextUI.Print(text, displayName);
    }

    /**
     * @param seq Alternate seq id
     */
    Voice(seq?: string) {
        let stxt;
        if (this.nextVoice) {
            stxt = this.nextVoice;
            this.nextVoice = undefined;
        }
        else {
            if (!this.voiceFmt) return;
            let s;
            if (isNaN(parseInt(seq)) && seq !== undefined) {
                s = seq;
            }
            else { // number or undefined, ignore arg seq
                s = this.currentVoice;
                this.currentVoice++;
            }
            stxt = s;
            if (!isNaN(parseInt(s as string))) {
                stxt = this.voiceFmt;
                // TODO: real printf
                stxt = stxt
                    .replace("%s", LayerChara.voiceBase)
                    .replace("%03d", String(s).padStart(3, "0"));
            }
        }
        // drop extension
        stxt = (stxt as string).replace(/\.[a-z0-9]{2,5}$/i, "");
        const pseudoCmd: KSFunc = {
            type: "func",
            name: this.name,
            option: ["Voice_pseudoCMD"],
            param: {
                storage: stxt
            },
        };
        Sound.Process(pseudoCmd);
    }
}

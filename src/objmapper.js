import YZFgImg from "./ui/fgimg";

export default class ObjectMapper {
    static Init() {
        this.objs = []
        this.name2type = {}
        this.innerobj = null;
        // Object data cache
        this.odatacache = {};
    }

    static LoadObject(obj) {
        this.innerobj = obj;
        for (const i of ["times", "stages", "positions", "actions", "transitions", "characters", "emotions"]) {
            Object.keys(obj[i]).forEach(k => this.name2type[k] = i);
        }
        this.objs = Object.keys(this.name2type);
    }

    static HaveObject(obj) {
        return this.objs.includes(obj);
    }

    static NewLay(cmd) {
        var name = cmd.param.name;
        this.objs.push(name);
    }

    static DelLay(cmd) {
        var name = cmd.param.name;
        var idx = this.objs.indexOf(name);
        if (idx != -1) this.objs.splice(idx);
    }

    static MapObject(cmd) {
        let objdata = {}
        if (this.odatacache[cmd.name] === undefined) this.odatacache[cmd.name] = {};
        // handle registered opions here
        // then pass name & image id to imageinfo
        cmd.option.filter(o => this.objs.includes(o)).forEach(o => {
            if (objdata[this.name2type[o]] === undefined) objdata[this.name2type[o]] = [];
            let mo = this.innerobj[this.name2type[o]][o];
            if (mo.length === undefined) {
                objdata[this.name2type[o]].push(mo);
            }
            else {
                for (const i of mo) {
                    objdata[this.name2type[o]].push(i);
                }
            }
        });
        for (const key in objdata) {
            if (objdata.hasOwnProperty(key)) {
                const value = objdata[key];
                this.odatacache[cmd.name][key] = value;
            }
        }

        cmd.objdata = this.odatacache[cmd.name];
        let newcmd = JSON.parse(JSON.stringify(cmd));
        newcmd.option = cmd.option
            .filter(o => !this.objs.includes(o))
            .filter(o => !["sync", "nosync", "back", "front", "grayscale", "bvoice", "nextvoice", "resetcolor", "stopvoice", "hideemotion"].includes(o));
        newcmd.param = {}
        let ret = {};
        ret.objdata = cmd.objdata;
        ret.name = cmd.name;

        if (this.name2type[cmd.name] == "characters") {
            newcmd.name = this.GetNameInfo(cmd.name).standname;
            let img = YZFgImg.GetImageInfo(newcmd);
            if (img) {
                ret.image = img;
            }
        }
        return ret;
    }

    static TypeOf(cmd) {
        if (!cmd.param) return this.name2type[cmd];
        return this.name2type[cmd.name];
    }

    // e.g:神様
    // return:
    // - name: 姫
    // - voicefile: kam%s_%03d.ogg
    // - standname:
    static GetNameInfo(name) {
        let ret = {
            name: null,
            voicefile: null,
            standname: null
        };
        if (name == null) return ret;
        let c = this.innerobj.characters[name];
        if (c.nameAlias !== undefined) ret.name = c.nameAlias;
        if (c.voiceFile !== undefined) ret.voicefile = c.voiceFile;
        if (c.standName !== undefined) ret.standname = c.standName;
        else ret.standname = name;
        return ret;

    }
}
ObjectMapper.Init();
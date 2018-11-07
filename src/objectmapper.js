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

    static NewLay(cmd) {
        var name = cmd.param.name;
        this.objs.push(name);
    }

    static DelLay(cmd) {
        var name = cmd.param.name;
        var idx = this.objs.indexOf(name);
        if (idx != -1) this.objs.splice(idx);
    }

    static GetProperty(str) {
        if (!this.IsProperty(str)) return undefined;
        let t = this.TypeOf(str);
        return this.innerobj[t][str];
    }

    static IsProperty(str) {
        return this.objs.includes(str);
    }

    static TypeOf(cmd) {
        if (!cmd.param) return this.name2type[cmd];
        return this.name2type[cmd.name];
    }
}
ObjectMapper.Init();
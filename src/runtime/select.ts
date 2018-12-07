import TJSVM from "../tjsvm";
import YZSelectUI from "../ui/select";

interface JumpDest {
    script: string,
    target: string
};

export class YZSelectData {

    text: string;
    dest: JumpDest;
    operation: string;
    mapplace: any;
    /**
     * 
     * @param text Text to show
     * @param dest When selected, dest position
     * @param operation When selected, TJS to run (when map, only when true, show this option)
     * @param mapplace On which position
     */
    constructor(text: string, dest: JumpDest, operation: string, mapplace: any) {
        this.text = text;
        this.dest = dest;
        this.operation = operation;
        this.mapplace = mapplace;
        if (!dest.script && !dest.target) this.dest = undefined;
    }
}

// all select logic here
export default class YZSelect {
    static MapSelectData: YZSelectData[] = [];
    static SelectData: YZSelectData[] = [];

    static MapSelectInit() {
        this.MapSelectData = []
    }

    // TODO: mselect is Tenshin Ranman only command?
    // add map select option
    static MapSelectAdd(cmd: KSLine) {
        let p = cmd.param;
        this.MapSelectData.push(
            new YZSelectData(
                p.name as string,
                {
                    script: p.storage as string,
                    target: p.target as string
                },
                p.cond as string,
                p.place)
        );
    }

    // raise a map select
    static async MapSelect() {
        let ro = await YZSelectUI.MSelect(this.MapSelectData);
        this.MapSelectData = [];
        if (!ro.dest) return undefined;
        return ro.dest;
    }

    static SelectAdd(cmd: KSLine) {
        let p = cmd.param;
        this.SelectData.push(
            new YZSelectData(
                p.text as string,
                {
                    script: p.storage as string,
                    target: p.target as string
                },
                p.exp as string,
                p.storage)
        );
    }

    // raise a normal select
    static async Select() {
        let ro = await YZSelectUI.Select(this.SelectData);
        if (ro.operation) TJSVM.eval(ro.operation);
        this.SelectData = [];
        if (!ro.dest) return undefined;
        return ro.dest;
    }

    static Next(cmd: KSLine) {
        let { name, param, option } = cmd;
        if (param.eval != undefined) {
            let r = TJSVM.eval(cmd.param.eval as string);
            // cancel jump
            if (!r) return undefined;
        }
        return [param.target, param.storage]
    }
}
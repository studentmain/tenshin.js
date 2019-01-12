import LayerBase from "./base";
import ObjectMapper from "../../objectmapper";
import YZLayer from "../../ui/layer";
export default class LayerExtra extends LayerBase {
    readonly zindex = 17;
    public static Init() {
        return;
    }
    public static GetInstance(cmd?: KSFunc): LayerExtra {
        if (this.instance === undefined) {
            this.instance = new LayerExtra();
        }
        return this.instance;
    }
    private static instance: LayerExtra = undefined;

    CalculateSubLayer(cmd: KSFunc): LayerInfo[] {
        switch (cmd.name) {
            case "newlay":
                const { name, option, param } = cmd;
                const lname = param.name as string;
                const lfile = param.file as string;
                if (!lfile) { return; }
                ObjectMapper.AddLayer(lname);
                return [{ name: lfile }];
            case "dellay":
                YZLayer.Unset(cmd.param.name as string);
                ObjectMapper.RemoveLayer(cmd.param.name as string);
                return undefined;
            default:
                return [];
        }
    }
    CalculateName(cmd: KSFunc): string {
        switch (cmd.name) {
            case "newlay":
                const { name, option, param } = cmd;
                const lname = param.name as string;
                const lfile = param.file as string;
                if (!lfile) { return; }
                ObjectMapper.AddLayer(lname);
                return lname;
            case "dellay":
                YZLayer.Unset(cmd.param.name as string);
                ObjectMapper.RemoveLayer(cmd.param.name as string);
                return "";
            default:
                return cmd.name;
        }
    }
}

import FilePath from "../utils/filepath";
import * as $ from "jquery";

interface YZLayerData {
    width: number;
    height: number;
    left: number;
    top: number;
    zoom: number;
    files: LayerInfo[];
}

// Sub layer operation
class YZSubLayer {
    name: string;
    private fd: JQuery<HTMLElement>;
    private x: number;
    private y: number;

    constructor(name: string, parent: JQuery<HTMLElement>) {
        this.name = name;
        parent.append(
            $("<img>").attr("id", `sublayer_${this.name}`)
        );
        this.fd = $(`#sublayer_${this.name}`);
        this.fd
            .css("display", "none")
            .attr("src", FilePath.findMedia(this.name, "image"));
    }

    Draw(offset: Point) {
        const { x: _left, y: _top } = offset;
        this.fd
            .css("left", _left)
            .css("top", _top)
            .css("display", "");
    }

    Delete() {
        this.fd.remove();
    }

    async GetSize() {
        if (!this.x || !this.y) { // not cached
            const elm = this.fd.get(0) as HTMLImageElement;
            if (!elm.complete) { // not loaded
                await new Promise((resolve, reject) => { // wait image loaded
                    this.fd.one("load", () => resolve());
                    this.fd.one("error", () => reject());
                });
            }
            // ok,  now it's loaded
            this.x = elm.naturalWidth;
            this.y = elm.naturalHeight;
        }
        return [this.x, this.y];
    }

    ZIndex(z: number) {
        this.fd.css("z-index", z);
    }
}

export default class YZLayer {
    static rootDOM: JQuery<HTMLElement>;
    private static layers: {
        [name: string]: YZLayer
    } = {};
    private static type2zindex: {
        [type: string]: number
    } = {
            stages: 1,
            characters: 5
        };
    name: string;

    private previous: YZLayerData = {
        width: 0,
        height: 0,
        left: 0,    // relative offset with center
        top: 0,     // ......
        zoom: 100,
        files: [],
    };
    private current: YZLayerData;
    private transIn: any[] = [];
    private transOut: any[] = [];
    private actionSeq: any[] = [];
    private showed = true;

    private fd: JQuery<HTMLElement>;
    private sublayer: { [name: string]: YZSubLayer } = {};

    static Init() {
        this.rootDOM = $("#camera");
    }

    constructor(name: string, files: LayerInfo[], zindex?: number) {
        this.name = name;
        this.previous = {
            width: 0,
            height: 0,
            left: 0,    // relative offset with center
            top: 0,     // ......
            zoom: 100,
            files: [],
        };
        this.current = JSON.parse(JSON.stringify(this.previous));
        this.current.files = files || [];
        this.transIn = [];
        this.transOut = [];
        this.actionSeq = [];

        this.fd = $(`#layer_${this.name}`);
        this.sublayer = {};
        // generate div if not exist
        if (this.fd.length === 0) {
            YZLayer.rootDOM.append(
                $("<div>")
                    .attr("id", `layer_${this.name}`)
                    .css("z-index", zindex || 1)
            );
            this.fd = $(`#layer_${this.name}`);
        }
    }

    SetSubLayer(files: LayerInfo[]) {
        if (!files || files.length <= 0) return;
        // maybe diff here
        this.current.files = files || [];
        const newLayers = this.current.files.map(l => l.name);
        const onScreenlayer = Object.keys(this.sublayer);
        const deleted = onScreenlayer.filter(l => !newLayers.includes(l));
        const added = newLayers.filter(l => !onScreenlayer.includes(l));
        if (deleted.length > 0 || added.length > 0) this.showed = true;
    }

    SetSize(size: Point) {
        this.current.height = size.y;
        this.current.width = size.x;
    }

    SetZoomCenter(pos: Point) {
        // TODO: is this ok? Maybe make x optional
        this.fd.css("transform-origin", `${pos.x}% ${pos.y}%`);
    }

    // when [begintrans] called, do not exec Draw()
    // when [endtrans %TRANS%] called, set trans, then Draw()
    async Draw() {
        if (!this.showed) return;
        // cancel all animation
        this.fd.finish();
        const oldLayers = this.previous.files.map(l => l.name);
        const newLayers = this.current.files.map(l => l.name);
        if (newLayers.length === 0) {
            this.current.files = this.previous.files;
        }
        const onScreenlayer = Object.keys(this.sublayer);
        const deleted = onScreenlayer.filter(l => !newLayers.includes(l));
        const added = newLayers.filter(l => !onScreenlayer.includes(l));
        // oldLayers.forEach(f => this.subfd[f].finish());
        added.forEach(f => this.sublayer[f] = new YZSubLayer(f, this.fd));

        // execute transOut
        // Apply for all missing layer
        // in fact not executed here now...
        deleted.forEach(f => {
            this.sublayer[f].Delete();
            delete this.sublayer[f];
        });

        // fix z-index
        newLayers.forEach((f, i) => {
            this.sublayer[f].ZIndex(i);
        });
        // execute transIn
        // Apply for all added layer
        const [_winW, _winH] = Config.Display.WindowSize;
        const [_maxHeight, _maxWidth, _minHeight, _minWidth] = await this._DrawAndCalculateSubLayer();
        const [_divWidth, _divHeight] = [_maxWidth + _minWidth, _maxHeight + _minHeight];
        // when all draw complete
        // start animation
        const [_drawWidth, _drawHeight] = [_maxWidth - _minWidth, _maxHeight - _minHeight];
        const [_divLeft, _divTop] = [
            (_winW - _drawWidth) / 2 - _minWidth + this.current.left,
            (_winH - _drawHeight) / 2 - _minHeight + this.current.top
        ];
        this.current.height = this.current.height || _divHeight;
        this.current.width = this.current.width || _divWidth;
        this._DrawLayer(_divLeft, _divTop, this.current.height, this.current.width, this.current.zoom);
        this.previous = JSON.parse(JSON.stringify(this.current));
    }

    private async _DrawAndCalculateSubLayer() {
        const _maxHeightArray: number[] = [];
        const _maxWidthArray: number[] = [];
        const _minHeightArray: number[] = [];
        const _minWidthArray: number[] = [];
        await Promise.all(this.current.files.map(f =>
            (async () => {
                const { name, offset, size } = f;
                const _offset = offset || { x: 0, y: 0 };
                let _width;
                let _height;
                if (!size || !size.x || !size.y) { // need get size
                    [_width, _height] = await this.sublayer[name].GetSize();
                }
                else {
                    _width = size.x;
                    _height = size.y;
                }
                // calculate image draw window
                const { x: _left, y: _top } = _offset;
                _maxWidthArray.push(_left + _width);
                _maxHeightArray.push(_top + _height);
                _minWidthArray.push(_left);
                _minHeightArray.push(_top);
                this.sublayer[name].Draw(_offset);
            })() // Run in IIFE, it returns a Promise
        ));  // and Promise wait all... );})())); :-)
        const _maxHeight = _maxHeightArray.reduce((p, c) => p > c ? p : c, Number.MIN_SAFE_INTEGER);
        const _maxWidth = _maxWidthArray.reduce((p, c) => p > c ? p : c, Number.MIN_SAFE_INTEGER);
        const _minHeight = _minHeightArray.reduce((p, c) => p < c ? p : c, Number.MAX_SAFE_INTEGER);
        const _minWidth = _minWidthArray.reduce((p, c) => p < c ? p : c, Number.MAX_SAFE_INTEGER);
        return [_maxHeight, _maxWidth, _minHeight, _minWidth];
    }

    private _DrawLayer(left: number, top: number, height: number, width: number, zoom: number) {
        const realZoom = zoom / 100;
        this.fd
            .css("display", "")
            .css("top", top)
            .css("left", left)
            // fd height & width has unexpected influence to zoom position
            .css("height", height)
            .css("width", width)
            .css("transform", `scale(${realZoom})`);
    }

    Show() {
        this.showed = true;
    }

    Hide() {
        this.showed = false;
        this.fd.css("display", "none");
    }

    Delete() { // clear DOM .etc
        // draw last time, to execute transOut
        this.Draw();
        this.fd.remove();
    }

    Move(pos: Point) {
        if (isFinite(pos.x)) this.current.left = pos.x;
        if (isFinite(pos.y)) this.current.top = pos.y;
    }

    Zoom(zoom: number) {
        if (isFinite(zoom)) this.current.zoom = zoom;
    }

    Trace(str: string) {
        this.fd.attr("yz_traceinfo", str);
    }


    static Get(name: string) {
        return this.layers[name];
    }
    /**
     * Set a layer (new or existed)
     * @param name
     * @param files
     */
    static Set(name: string, files: LayerInfo[], zindex?: number) {
        if (!this.layers[name]) {
            this.layers[name] = new YZLayer(name, files, zindex);
        }
        else {
            if (files && files.length > 0) this.layers[name].SetSubLayer(files);
        }
        return this.layers[name];
    }

    static Unset(name: string) {
        const t = this.layers[name];
        if (!t) return;
        t.Delete();
        delete this.layers[name];
    }
}

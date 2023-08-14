export interface DrawCtrl {
  mode: "draw" | "erase" | "select" | "text" | "rect" | "picture";
  finger: boolean;
  lineWidth: number;
  eraserWidth: number;
  color: string;
  highlight: boolean;
  lasso: boolean;
  pixelEraser: boolean;
  globalEraser: boolean;
  widthList: number[];
  imageSrc: string;
}

export const defaultWidthList = [10, 20, 30, 50];
export const defaultDrawCtrl: Readonly<DrawCtrl> = {
  mode: "draw",
  finger: true,
  lineWidth: 10,
  eraserWidth: 10,
  color: "#000000",
  highlight: false,
  lasso: false,
  pixelEraser: false,
  globalEraser: false,
  widthList: defaultWidthList,
  imageSrc: "",
};

// Type declarations for modules without type definitions

declare module '@amcharts/amcharts5' {
  export namespace am5 {
    export class Root {
      static new(container: HTMLElement | string, root?: Root): Root;
      dispose(): void;
      setThemes(themes: any[]): void;
      interfaceColors: {
        set(key: string, value: any): void;
        [key: string]: any;
      };
      container: {
        children: {
          push(item: any): any;
          [key: string]: any;
        };
        [key: string]: any;
      };
      verticalLayout: any;
      [key: string]: any;
    }
    export const color: {
      newInstance: (root: Root, color: string | number) => Color;
      (color: string | number): Color;
      [key: string]: any;
    };
    export class Color {
      [key: string]: any;
    }
    export class LinearGradient {
      static new(root: Root, target?: any): LinearGradient;
      constructor(root: Root, target?: any);
      [key: string]: any;
    }
    export class Bullet {
      static new(root: Root, target: any): Bullet;
      constructor(root: Root, target: any);
      [key: string]: any;
    }
    export class Label {
      static new(root: Root, target?: any): Label;
      constructor(root: Root, target?: any);
      [key: string]: any;
    }
    export class Legend {
      static new(root: Root, target?: any): Legend;
      constructor(root: Root, target?: any);
      [key: string]: any;
    }
    export const percent: (value: number) => any;
    export const p50: number;
    export const p100: number;
  }
  export = am5;
}

declare module '@amcharts/amcharts5/xy' {
  export namespace am5xy {
    export class XYChart {
      static new(root: any, target?: any): XYChart;
      constructor(root: any, target?: any);
      [key: string]: any;
    }
    export class CategoryAxis {
      static new(root: any, target?: any): CategoryAxis;
      constructor(root: any, target?: any);
      [key: string]: any;
    }
    export class AxisRendererX {
      static new(root: any, target?: any): AxisRendererX;
      constructor(root: any, target?: any);
      [key: string]: any;
    }
    export class ValueAxis {
      static new(root: any, target?: any): ValueAxis;
      constructor(root: any, target?: any);
      [key: string]: any;
    }
    export class AxisRendererY {
      static new(root: any, target?: any): AxisRendererY;
      constructor(root: any, target?: any);
      [key: string]: any;
    }
    export class ColumnSeries {
      static new(root: any, target?: any): ColumnSeries;
      constructor(root: any, target?: any);
      [key: string]: any;
    }
    export class XYCursor {
      static new(root: any, target?: any): XYCursor;
      constructor(root: any, target?: any);
      [key: string]: any;
    }
  }
  export = am5xy;
}

declare module '@amcharts/amcharts5/percent' {
  export namespace am5percent {
    export class PieChart {
      static new(root: any, target?: any): PieChart;
      constructor(root: any, target?: any);
      [key: string]: any;
    }
    export class PieSeries {
      static new(root: any, target?: any): PieSeries;
      constructor(root: any, target?: any);
      [key: string]: any;
    }
    export class SlicedChart {
      static new(root: any, target?: any): SlicedChart;
      constructor(root: any, target?: any);
      [key: string]: any;
    }
  }
  export = am5percent;
}

declare module '@amcharts/amcharts5/themes/Animated' {
  export class Animated {
    static new(root: any): any;
    constructor(root: any);
    [key: string]: any;
  }
  export default Animated;
}

declare module 'exceljs' {
  namespace ExcelJS {
    export class Workbook {
      constructor();
      addWorksheet(name?: string): Worksheet;
      xlsx: {
        writeBuffer(): Promise<Buffer>;
        [key: string]: any;
      };
      [key: string]: any;
    }
    export interface Worksheet {
      [key: string]: any;
    }
    export interface Row {
      [key: string]: any;
    }
    export interface Cell {
      [key: string]: any;
    }
    export interface Column {
      [key: string]: any;
    }
  }
  class ExcelJS {
    static Workbook: typeof ExcelJS.Workbook;
    [key: string]: any;
  }
  export = ExcelJS;
}

declare module 'file-saver' {
  export function saveAs(blob: Blob, filename: string): void;
}

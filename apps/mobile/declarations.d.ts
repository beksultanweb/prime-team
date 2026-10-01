declare module "*.svg" {
    import React from "react";
    import { SvgProps } from "react-native-svg";
    const content: React.FC<SvgProps>;
    export default content;
}

// Side-effect style imports (global.css for NativeWind, tiptap.css in the DOM editor)
declare module "*.css";

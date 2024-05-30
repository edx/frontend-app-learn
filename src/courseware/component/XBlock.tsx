import React from "react";
import { XBlockData, XBlockDataV2 } from "./types";
import LegacyXBlock from "./LegacyXBlock";

interface XBlockRenderContextData {

}

const XBlockRenderContext = React.createContext<XBlockRenderContextData|undefined>(undefined);



export const XBlockRenderingContext: React.FC<{children: React.ReactNode}> = ({children}) => {
    const ctx = {};
    return <XBlockRenderContext.Provider value={ctx}>
        {/**
         * This import map defines the standard modules that the individual client-side XBlock JS implementations can
         * import and use.
         */}
        <script type="importmap">
            {JSON.stringify({
                imports: {
                    "xblock2-client-v0": "${getConfig().BASE_URL}/xblock/client-v0.js"
                },
            })}
        </script>
        {children}
    </XBlockRenderContext.Provider>;
};




export const XBlock: React.FC<XBlockDataV2> = ({ id, ...props }) => {

    const ctx = React.useContext(XBlockRenderContext);
    if (!ctx) {
        return <p>Error: cannot display a v2 XBlock outside of an <code>XBlockRenderContext</code>.</p>
    }

    const ComponentName = `xblock-${props.blockType}`;
    const xblockProps = {
        class: 'xblock-component xblock-v2',  // For web components in React, the prop is 'class', not 'className'
        'content-fields': JSON.stringify(props.contentFields),
        'system-fields': JSON.stringify(props.systemFields),
        'user-fields': JSON.stringify(props.userFields),
    };

    // return React.createElement(componentName, xblockProps);
    return <ComponentName {...xblockProps as any} />
};

/**
 * Render a courseware component (XBlock) which may be V1 or V2.
 */
export const AutoXBlock: React.FC<XBlockData> = (props) => {
    if (props.xblockApiVersion === 2) {
        return <XBlock {...props} />;
    }
    return <LegacyXBlock {...props} />;
};

export default XBlock;

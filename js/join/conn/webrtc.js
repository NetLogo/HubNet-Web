import deepFreeze from "/js/static/deep-freeze.js";

import { commonConfig } from "/js/static/webrtc.js";

const rtcConfig = { ...commonConfig };

deepFreeze(rtcConfig);

export { rtcConfig };

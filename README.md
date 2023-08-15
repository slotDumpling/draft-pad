```ts
import { Draw, DrawState } from "draft-pad";
import { FC, useState } from "react";
const RATIO = 1.5;
const WIDTH = 2000;

const MyDraftPad: FC = () => {
  const [drawState, setDrawState] = useState(DrawState.createEmpty(RATIO, WIDTH));
  return <Draw drawState={drawState} onChange={setDrawState} />;
};
```

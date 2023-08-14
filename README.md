```ts
import { Draw, DrawState } from "draft-pad";

const MyDraftPad = () => {
  const [drawState, setDrawState] = useState(DrawState.createEmpty(1.5));
  return <Draw drawState={drawState} onChange={setDrawState} />;
};
```

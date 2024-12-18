import { List, Record, OrderedMap, Map } from "immutable";
import { NIL, v4, v5, validate } from "uuid";
import Heap from "heap";

export interface Stroke {
  type: "STROKE";
  uid: string;
  pathData: string;
  timestamp: number;
}

export type StrokeData =
  | Stroke
  | {
      type: "HIDE";
      uid: string;
      originUid: string;
      timestamp: number;
    }
  | {
      type: "MUTATE";
      uid: string;
      originUid: string;
      pathData: string;
      timestamp: number;
    };

export type StrokeRecord = globalThis.Record<string, StrokeData>;
export type Mutation = [string, string];
export type Splitter = [string, string[]];

export type Operation =
  | {
      type: "add";
      stroke: Stroke;
    }
  | {
      type: "add_list";
      strokeList: Stroke[];
    }
  | {
      type: "erase";
      erased: string[];
    }
  | {
      type: "mutate";
      mutations: Mutation[];
      timestamp: number;
    }
  | {
      type: "split";
      splitters: Splitter[];
    }
  | {
      type: "undo";
    }
  | {
      type: "redo";
    };

interface DrawStateRecordType {
  strokes: OrderedMap<string, StrokeData>;
  mutationPairs: Map<string, string>; //{ [originID]: [mutationID] }
  undoStack: List<DrawStateRecord>;
  historyStack: List<DrawStateRecord>;
}

type DrawStateRecord = Record<DrawStateRecordType>;

const defaultRecord: Readonly<DrawStateRecordType> = {
  strokes: OrderedMap(),
  mutationPairs: Map(),
  undoStack: List(),
  historyStack: List(),
};

const defaultFactory = Record(defaultRecord);

export interface FlatState {
  strokes: StrokeRecord;
  operations?: Operation[];
}

export const getDefaultFlatState = (): FlatState => {
  return { strokes: {} };
};

export class DrawState {
  constructor(
    private immutable: DrawStateRecord,
    public readonly width: number,
    public readonly height: number,
    public lastOp?: Operation
  ) {}

  getImmutable() {
    return this.immutable;
  }

  getUndoStack() {
    return this.getImmutable().get("undoStack");
  }

  getHistoryStack() {
    return this.getImmutable().get("historyStack");
  }

  getStrokeMap() {
    return this.getImmutable().get("strokes");
  }

  getLastStroke() {
    return this.getStrokeMap().last();
  }

  getMutationPairs() {
    return this.getImmutable().get("mutationPairs");
  }

  isEmpty() {
    return this.getStrokeMap().size === 0;
  }

  hasStroke(uid: string) {
    return this.getStrokeMap().has(uid);
  }

  static createEmpty(ratio: number, width: number) {
    return new DrawState(defaultFactory(), width, width * ratio);
  }

  static undo(drawState: DrawState) {
    const lastOp: Operation = { type: "undo" };
    const lastRecord = drawState.getHistoryStack().last();
    if (!lastRecord) return drawState;
    const undoStack = drawState
      .getUndoStack()
      .unshift(drawState.getImmutable());
    return new DrawState(
      lastRecord.set("undoStack", undoStack),
      drawState.width,
      drawState.height,
      lastOp
    );
  }

  static redo(drawState: DrawState) {
    const lastOp: Operation = { type: "redo" };

    const nextRecord = drawState.getUndoStack().first();
    if (!nextRecord) return drawState;
    return new DrawState(nextRecord, drawState.width, drawState.height, lastOp);
  }

  static addStroke(drawState: DrawState, pathData: string) {
    const uid = v4();
    const timestamp = Date.now();
    const stroke: Stroke = { pathData, uid, timestamp, type: "STROKE" };
    return DrawState.pushStroke(drawState, stroke);
  }

  static addStrokeList(
    drawState: DrawState,
    pathDataList: string[],
    callback?: (IDs: string[]) => void
  ) {
    const newIDs: string[] = [];
    const timestamp = Date.now();
    const strokeList: Stroke[] = pathDataList.map((pathData) => {
      const uid = v4();
      newIDs.push(uid);
      return { type: "STROKE", pathData, timestamp, uid };
    });
    callback?.(newIDs);

    return DrawState.pushStrokeList(drawState, strokeList);
  }

  static pushStroke(drawState: DrawState, stroke: Stroke) {
    const { uid } = stroke;
    const prevRecord = drawState.getImmutable();
    const currRecord = prevRecord
      .update("strokes", (s) => s.set(uid, stroke))
      .update("historyStack", (s) => s.push(prevRecord))
      .delete("undoStack");

    const lastOp: Operation = { type: "add", stroke };

    return new DrawState(currRecord, drawState.width, drawState.height, lastOp);
  }

  static pushStrokeList(drawState: DrawState, strokeList: Stroke[]) {
    const prevRecord = drawState.getImmutable();
    const currRecord = prevRecord.update("strokes", (s) =>
      s.merge(strokeList.map((stroke) => [stroke.uid, stroke]))
    );
    const lastOp: Operation = { type: "add_list", strokeList };

    return new DrawState(currRecord, drawState.width, drawState.height, lastOp);
  }

  static eraseStrokes(drawState: DrawState, erased: string[]) {
    if (erased.length === 0) return drawState;
    const prevRecord = drawState.getImmutable();
    let strokes = drawState.getStrokeMap();
    const hidden = erased.filter((uid) => !strokes.has(uid));
    strokes = strokes.deleteAll(erased);
    hidden.forEach((hideID) => {
      const uid = v4();
      strokes = strokes.set(uid, {
        type: "HIDE",
        uid,
        originUid: hideID,
        timestamp: Date.now(),
      });
    });

    const currRecord = prevRecord
      .set("strokes", strokes)
      .update("historyStack", (s) => s.push(prevRecord))
      .delete("undoStack");

    const lastOp: Operation = { type: "erase", erased };

    return new DrawState(currRecord, drawState.width, drawState.height, lastOp);
  }

  static mutateStrokes(
    drawState: DrawState,
    mutations: Mutation[],
    timestamp = Date.now()
  ) {
    if (mutations.length === 0) return drawState;
    const prevRecord = drawState.getImmutable();
    let strokes = drawState.getStrokeMap();
    let mutationPairs = drawState.getMutationPairs();
    mutations.forEach(([uid, pathData]) => {
      const newUid = v4();
      strokes = strokes.set(newUid, {
        type: "MUTATE",
        uid: newUid,
        originUid: uid,
        pathData,
        timestamp,
      });
      const prevMutationUid = mutationPairs.get(uid);
      mutationPairs = mutationPairs.set(uid, newUid);
      strokes = strokes.delete(prevMutationUid ?? "");
    });
    const currRecord = prevRecord
      .set("strokes", strokes)
      .set("mutationPairs", mutationPairs)
      .update("historyStack", (s) => s.push(prevRecord))
      .delete("undoStack");

    const lastOp: Operation = { type: "mutate", mutations, timestamp };

    return new DrawState(currRecord, drawState.width, drawState.height, lastOp);
  }

  static splitStrokes(drawState: DrawState, splitters: Splitter[]) {
    if (splitters.length === 0) return drawState;
    const splitMap = Map(splitters);
    let strokes = OrderedMap<string, StrokeData>();
    const prevStrokes = drawState.getStrokeMap();
    prevStrokes.forEach((stroke, prevUid) => {
      const splitStrokes = splitMap.get(prevUid);
      if (splitStrokes) {
        strokes = strokes.merge(
          splitStrokes.map((pathData, index) => {
            // update legacy uid solution.
            if (!validate(prevUid)) prevUid = v5(prevUid, NIL);

            const uid = v5(String(index), prevUid);
            const { timestamp } = stroke;
            return [uid, { pathData, timestamp, uid, type: "STROKE" }];
          })
        );
      } else {
        strokes = strokes.set(prevUid, stroke);
      }
    });
    const prevRecord = drawState.getImmutable();
    const currRecord = prevRecord
      .set("strokes", strokes)
      .update("historyStack", (s) => s.push(prevRecord));
    const lastOp: Operation = { type: "split", splitters };
    return new DrawState(currRecord, drawState.width, drawState.height, lastOp);
  }

  // sync with mutation.
  static syncStrokeTime(drawState: DrawState, uid: string, timestamp: number) {
    const prevStroke = drawState.getStrokeMap().get(uid);
    if (!prevStroke) return;
    prevStroke.timestamp = timestamp;
  }

  static pushOperation(drawState: DrawState, op: Operation) {
    switch (op.type) {
      case "add":
        return DrawState.pushStroke(drawState, op.stroke);
      case "add_list":
        return DrawState.pushStrokeList(drawState, op.strokeList);
      case "erase":
        return DrawState.eraseStrokes(drawState, op.erased);
      case "mutate":
        return DrawState.mutateStrokes(drawState, op.mutations, op.timestamp);
      case "undo":
        return DrawState.undo(drawState);
      case "redo":
        return DrawState.redo(drawState);
      case "split":
        return DrawState.splitStrokes(drawState, op.splitters);
      default:
        return drawState;
    }
  }

  static flaten(drawState: DrawState): FlatState {
    const strokes = drawState.getImmutable().get("strokes").toObject();
    return { strokes };
  }

  static loadFromFlat(
    flatState: FlatState,
    ratio: number,
    width: number
  ): DrawState {
    const { strokes, operations } = flatState;
    let strokeMap = OrderedMap(strokes);
    let mutationPairs = Map<string, string>();

    Object.entries(strokes).forEach(([uid, strokeData]) => {
      if (strokeData.type !== "MUTATE") return;
      const prevMutationUid = mutationPairs.get(strokeData.originUid);
      mutationPairs = mutationPairs.set(strokeData.originUid, uid);
      if (prevMutationUid) strokeMap = strokeMap.delete(prevMutationUid);
    });

    let ds = new DrawState(
      defaultFactory()
        .set("strokes", strokeMap)
        .set("mutationPairs", mutationPairs),
      width,
      width * ratio
    );
    operations?.forEach((op) => (ds = DrawState.pushOperation(ds, op)));
    return ds;
  }

  static mergeStates(...states: DrawState[]) {
    const iterators = states.map((ds) => ds.getStrokeMap().values());
    let mergedStrokes = OrderedMap<string, Stroke>();
    const heap = new Heap<[StrokeData, number]>(
      ([s0], [s1]) => s0.timestamp - s1.timestamp
    );

    iterators.forEach((iter, index) => {
      const { value, done } = iter.next();
      done || heap.push([value, index]);
    });

    while (heap.size() > 0) {
      const record = heap.pop();
      if (!record) break;
      const [stroke, index] = record;

      if (stroke.type === "HIDE") {
        mergedStrokes = mergedStrokes.delete(stroke.originUid);
      } else if (stroke.type === "MUTATE") {
        const { originUid, pathData } = stroke;
        mergedStrokes = mergedStrokes.update(
          originUid,
          (s) => s! && { ...s, pathData }
        );
      } else {
        const { uid } = stroke;
        mergedStrokes = mergedStrokes.set(uid, stroke);
      }

      const iterator = iterators[index];
      if (!iterator) break;
      const { value, done } = iterator.next();
      done || heap.push([value, index]);
    }
    return mergedStrokes;
  }
}

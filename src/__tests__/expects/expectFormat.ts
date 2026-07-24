import {eslint, tsc} from "../utils";

export const expectFormat = async () => {
  try {
    console.log(await tsc());
    console.log(await eslint());
  } catch (e) {
    console.error(e);
    expect(e).toBeUndefined();
  }
}

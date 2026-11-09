import { sources } from "./inputs";
import { checkSourceBindings } from "./rust-bindings";

const args = process.argv.slice(2);
if (args.length > 1 || args.some((value) => value !== "--prepare"))
  throw new Error("Unknown source binding option");
const { shared } = sources({ prepare: false });
checkSourceBindings(shared, args[0] === "--prepare");

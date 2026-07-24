import {Automaton} from "@automatons/tools";
import {generate} from "./generator";

const generatorTypescriptNextjsServer: Automaton = (openapi, settings) => generate(openapi, settings);

export default generatorTypescriptNextjsServer;

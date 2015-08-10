import {map, extend, pick, omit, curry, Fx} from "../common/common"

import {IRawParams} from "../params/interface"

import {IState} from "../state/interface"
import StateReference from "../state/stateReference"

import {INode, IParamsNode, ITransNode, IParamsPath, ITransPath} from "../path/interface"
import Path from "../path/path"

import Resolvable from "../resolve/resolvable"

const makeResolvable = (node) =>
    (fn, name: string) => new Resolvable(name, fn, node.state);

const adaptParamsToTrans = (node: IParamsNode) => {
  let ownResolvables = map(node.state.resolve, makeResolvable(node));
  
  return {
    state: node.state,
    ownParams: node.ownParams,
    ownResolvables: ownResolvables
  };
};

export default class PathFactory {
  constructor(rootGetter: () => IState) { 
    this.root = rootGetter
  }

  root(): IState {
    return null;
  }

  paramsPath(ref: StateReference): IParamsPath { 
    let states = ref ? ref.$state().path : [];
    let params = ref ? ref.params() : {};
    states = [this.root()].concat(states);
    const makeParamsNode = (state: IState) => ({ state, ownParams: state.ownParams.$$values(params) });
    
    let nodes = states.map(makeParamsNode);
    return new Path(nodes);
  }

  /**
   * Given a fromPath and a toPath, returns a new to path which inherits parameters from the fromPath
   *
   * For a parameter in a node to be inherited from the from path:
   * - The toPath's node must have a matching node in the fromPath (by state).
   * - The parameter name must not be found in the toKeys parameter array.
   *
   * Note: the keys provided in toKeys are intended to be those param keys explicitly specified by some
   * caller, for instance, $state.transitionTo(..., toParams).  If a key was found in toParams,
   * it is not inherited from the fromPath.
   */
  static inheritParams(fromPath: IParamsPath, toPath: IParamsPath, toKeys: string[] = []): IParamsPath {
    function nodeParamVals(path: IParamsPath, state: IState): IRawParams {
      var node = path.elementForState(state);
      return extend({}, node && node.ownParams);
    }
    
    /** 
     * Given an IParamsNode "toNode", return a new IParamsNode with param values inherited from the
     * matching node in fromPath.  Only inherit keys that aren't found in "toKeys" from the node in "fromPath""
     */
    function makeInheritedParamsNode(fromPath: IParamsPath, toKeys: string[], toNode: IParamsNode): IParamsNode {
      // All param values for the node (may include default key/vals, when key was not found in toParams)
      let toParamVals = extend({}, toNode && toNode.ownParams);
      // limited to only those keys found in toParams
      var incomingParamVals = pick(toParamVals, toKeys);
      toParamVals = omit(toParamVals, toKeys);
      let fromParamVals = nodeParamVals(fromPath, toNode.state) || {};
      // extend toParamVals with any fromParamVals, then override any of those those with incomingParamVals
      let ownParamVals: IRawParams = extend(toParamVals, fromParamVals, incomingParamVals);
      return { state: toNode.state, ownParams: ownParamVals };
    }
    
    // The param keys specified by the incoming toParams
    return new Path(<IParamsNode[]> toPath.nodes().map(curry(makeInheritedParamsNode)(fromPath, toKeys)));
  }
  
  static transPath(path: IParamsPath): ITransPath {
    return path.slice(0).adapt(adaptParamsToTrans)
  }
}

import Radx from '.';
import * as constants from './compiler/constants';
import * as getHandler from './compiler/getHandler';
import * as guard from './compiler/guard';
import * as index from './compiler/index';
import * as node from './compiler/node';
import * as resolveArgs from './compiler/resolveArgs';
import * as store from './compiler/store';
import * as wrapper from './compiler/wrapper';

export const compiler = {
    constants, Radx, resolveArgs, getHandler,
    guard, index, node, store, wrapper
}

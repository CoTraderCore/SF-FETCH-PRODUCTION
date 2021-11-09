// import { BN, fromWei, toWei } from 'web3-utils'
// import ether from './helpers/ether'
// import EVMRevert from './helpers/EVMRevert'
// import { duration } from './helpers/duration'
// import { PairHash } from '../config'
//
//
// const BigNumber = BN
// const timeMachine = require('ganache-time-traveler')
//
// require('chai')
//   .use(require('chai-as-promised'))
//   .use(require('chai-bignumber')(BigNumber))
//   .should()
//
// const ETH_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
//
// // real contracts
// const UniswapV2Factory = artifacts.require('./UniswapV2Factory.sol')
// const UniswapV2Router = artifacts.require('./UniswapV2Router02.sol')
// const UniswapV2Pair = artifacts.require('./UniswapV2Pair.sol')
//
//
// let uniswapV2Factory,
//     uniswapV2Router
//
//
// contract('Pair-hash', function([userOne, userTwo, userThree]) {
//
//   async function deployContracts(){
//     // deploy contracts
//     uniswapV2Factory = await UniswapV2Factory.new(userOne)
//   }
//
//   beforeEach(async function() {
//     await deployContracts()
//   })
//
//   describe('INIT', function() {
//     it('PairHash correct', async function() {
//       assert.equal(
//         String(await uniswapV2Factory.pairCodeHash()).toLowerCase(),
//         String(PairHash).toLowerCase(),
//       )
//     })
//   })
//   //END
// })

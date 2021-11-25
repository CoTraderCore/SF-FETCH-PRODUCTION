import { BN, fromWei, toWei } from 'web3-utils'
import ether from './helpers/ether'
import EVMRevert from './helpers/EVMRevert'
import { duration } from './helpers/duration'
import { PairHash } from '../config'
import BigNumber from 'bignumber.js'

const timeMachine = require('ganache-time-traveler')

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BN))
  .should()

const ETH_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

// real contracts
const UniswapV2Factory = artifacts.require('./UniswapV2Factory.sol')
const UniswapV2Router = artifacts.require('./UniswapV2Router02.sol')
const UniswapV2Pair = artifacts.require('./UniswapV2Pair.sol')
const WETH = artifacts.require('./WETH9.sol')
const WTOKEN = artifacts.require('./WTOKEN.sol')
const TOKEN = artifacts.require('./TOKEN.sol')
const Stake = artifacts.require('./Stake.sol')
const Fetch = artifacts.require('./Fetch.sol')
const NFT = artifacts.require('./NFT.sol')
const Sale = artifacts.require('./SaleWithLD.sol')
const SplitFormula = artifacts.require('./SplitFormula')
const LDManager = artifacts.require('./LDManager')

const url = "https://gateway.pinata.cloud/ipfs/QmNVZdcfwaadBzKkDFfGXtqNdKwEbMsQY5xZJxfSxNcK2i/1/"
const nftType = ".json"
const NFTPrice = toWei("1")
const MINLDAmount = toWei("600")

const stakeDuration = duration.years(5)
const antiDumpingDelay = duration.days(30)

let pancakeFactory,
    pancakeRouter,
    weth,
    token,
    pair,
    pancakePairAddress,
    stake,
    stakeSecond,
    fetch,
    nft,
    sale,
    wtoken,
    splitFormula,
    splitFormulaSecond,
    ldManager


contract('Fetch-with-LD-test', function([userOne, userTwo, userThree]) {

  async function deployContracts(){
    // deploy contracts
    weth = await WETH.new()

    pancakeFactory = await UniswapV2Factory.new(userOne)
    pancakeRouter = await UniswapV2Router.new(pancakeFactory.address, weth.address)

    token = await TOKEN.new(pancakeRouter.address)
    wtoken = await WTOKEN.new(token.address)

    const halfOfTotalSupply = BigNumber(BigNumber(BigNumber(await token.totalSupply()).dividedBy(2)).integerValue()).toString(10)

    // add token liquidity to Pancake
    await token.approve(pancakeRouter.address, halfOfTotalSupply)
    await pancakeRouter.addLiquidityETH(
      token.address,
      halfOfTotalSupply,
      1,
      1,
      userOne,
      "1111111111111111111111"
    , { from:userOne, value:toWei(String(500)) })

    pancakePairAddress = await pancakeFactory.allPairs(0)
    pair = await UniswapV2Pair.at(pancakePairAddress)

    nft = await NFT.new(10000, userOne, url, nftType)

    const initialRate = await pancakeRouter.getAmountsOut(
      1000000000,
      [token.address, weth.address]
    )

    splitFormula = await SplitFormula.new(
      initialRate[1],
      MINLDAmount,
      pancakeRouter.address,
      pair.address,
      token.address
    )

    splitFormulaSecond = await SplitFormula.new(
      initialRate[1],
      MINLDAmount,
      pancakeRouter.address,
      pair.address,
      token.address
    )

    stake = await Stake.new(
      userOne,
      token.address,
      wtoken.address,
      nft.address,
      duration.days(30),
      100,
      NFTPrice,
      userOne,
      antiDumpingDelay
    )

    stakeSecond = await Stake.new(
      userOne,
      token.address,
      wtoken.address,
      nft.address,
      duration.days(30),
      100,
      NFTPrice,
      userOne,
      antiDumpingDelay
    )

    ldManager = await LDManager.new(
      pancakeRouter.address,
      token.address
    )

    sale = await Sale.new(
      token.address,
      userOne,
      pancakeRouter.address,
      ldManager.address
    )

    fetch = await Fetch.new(
      weth.address,
      pancakeRouter.address,
      stake.address,
      token.address,
      sale.address,
      wtoken.address,
      splitFormula.address
    )


    // exclude stake from fee and balance limit
    await token.excludeFromFee(stake.address)
    await token.excludeFromTransferLimit(stake.address)

    // exclude fetch from fee and balance limit
    await token.excludeFromFee(fetch.address)
    await token.excludeFromTransferLimit(fetch.address)

    // exclude sale from fee and balance limit
    await token.excludeFromFee(sale.address)
    await token.excludeFromTransferLimit(sale.address)

    // exclude wtoken from fee and balance limit
    await token.excludeFromFee(wtoken.address)
    await token.excludeFromTransferLimit(wtoken.address)

    // exclude ldManager from fee and balance limit
    await token.excludeFromFee(ldManager.address)
    await token.excludeFromTransferLimit(ldManager.address)

    // send all remains to claim stake
    const safeMoonRemains = await token.balanceOf(userOne)
    const halfOfRemains = BigNumber(safeMoonRemains).dividedBy(2)
    const stakeRewards = halfOfRemains
    const saleAmount = halfOfRemains.dividedBy(2)
    const ldManagerAmount = halfOfRemains.dividedBy(2)

    // stake
    await token.transfer(stake.address, stakeRewards)
    await stake.setRewardsDistribution(userOne)
    await stake.notifyRewardAmount(stakeRewards)

    // sell
    await token.transfer(sale.address, saleAmount)

    // ld manager
    await token.transfer(ldManager.address, ldManagerAmount)

    // activate burn
    await fetch.updateBurnStatus(true)

    // transfer ownership from nft to stake
    await nft.transferOwnership(stake.address)

    // update white list for fetch
    await stake.updateWhiteList(fetch.address, true)
    await sale.updateWhiteList(fetch.address, true)
    await stakeSecond.updateWhiteList(fetch.address, true)
  }

  beforeEach(async function() {
    await deployContracts()
  })


  describe('INIT', function() {

    it('PairHash correct', async function() {
      assert.equal(
        String(await pancakeFactory.pairCodeHash()).toLowerCase(),
        String(PairHash).toLowerCase(),
      )
    })

    it('Factory in Router correct', async function() {
      assert.equal(
        String(await pancakeRouter.factory()).toLowerCase(),
        String(pancakeFactory.address).toLowerCase(),
      )
    })

    it('WETH in Router correct', async function() {
      assert.equal(
        String(await pancakeRouter.WETH()).toLowerCase(),
        String(weth.address).toLowerCase(),
      )
    })

    it('Correct init claim Stake', async function() {
      assert.equal(await stake.rewardsToken(), token.address)
      assert.equal(await stake.stakingToken(), wtoken.address)
    })

    it('Correct isExcluded status for stake', async function() {
      assert.equal(await token.isExcludedFromFee(stake.address), true)
      assert.equal(await token.isExcludedFromTransferLimit(stake.address), true)
    })

    it('Correct isExcluded status for user', async function() {
      assert.equal(await token.isExcludedFromFee(userTwo), false)
      assert.equal(await token.isExcludedFromTransferLimit(userTwo), false)
    })
})

describe('NFT', function() {
   it('NFT claim NOT works without fetch', async function() {
     await stake.claimNFT(0, { from:userTwo }).should.be.rejectedWith(EVMRevert)
     assert.equal(await nft.balanceOf(userTwo), 0)
   })

   it('NFT claim works after fetch Deposit', async function() {
     assert.equal(await nft.balanceOf(userTwo), 0)
     // deposit
     await fetch.deposit({ from:userTwo, value:toWei(String(1)) })
     // claim
     await stake.claimNFT(0, { from:userTwo })
     assert.equal(await nft.balanceOf(userTwo), 1)
   })
 })

 describe('Split formula', function() {
    it('Not owner can not update split formula', async function() {
      await fetch.updateSplitFormula(
        splitFormulaSecond.address,
        { from:userTwo }
      ).should.be.rejectedWith(EVMRevert)
    })

    it('Owner canupdate split formula', async function() {
      assert.equal(await fetch.splitFormula(), splitFormula.address)

      await fetch.updateSplitFormula(
        splitFormulaSecond.address
      )

      assert.equal(await fetch.splitFormula(), splitFormulaSecond.address)
    })
})

describe('Update burn status', function() {
    it('Not owner can not call updateBurnStatus', async function() {
      const statusBefore = await fetch.isBurnable()

      await fetch.updateBurnStatus(
        false,
        { from:userTwo }
      ).should.be.rejectedWith(EVMRevert)

      assert.equal(statusBefore, await fetch.isBurnable())
    })

    it('Owner can call updateBurnStatus', async function() {
      const statusBefore = await fetch.isBurnable()

      await fetch.updateBurnStatus(false)

      assert.notEqual(statusBefore, await fetch.isBurnable())
      assert.equal(await fetch.isBurnable(), false)
    })
})

describe('Update burn percent', function() {
    it('Not owner can not call updateBurnPercent', async function() {
      const stakeAddressBefore = await fetch.stakeAddress()

      await fetch.updateBurnPercent(
        5,
        { from:userTwo }
      ).should.be.rejectedWith(EVMRevert)
    })

    it('Owner can not call updateBurnPercent with wrong %', async function() {
      const stakeAddressBefore = await fetch.stakeAddress()

      await fetch.updateBurnPercent(
        0
      ).should.be.rejectedWith(EVMRevert)

      await fetch.updateBurnPercent(
        11
      ).should.be.rejectedWith(EVMRevert)

    })

    it('Owner can call updateBurnPercent and fetch now works with new 5% percent', async function() {
      // update address
      await fetch.updateBurnPercent(5)
      // test new stake
      // user two not hold any pool before deposit
      assert.equal(Number(await wtoken.balanceOf(userTwo)), 0)
      // stake don't have any pool yet
      assert.equal(Number(await wtoken.balanceOf(stake.address)), 0)
      // deposit
      await fetch.deposit({ from:userTwo, value:toWei(String(1)) })
      // fetch send all pool
      assert.equal(Number(await wtoken.balanceOf(fetch.address)), 0)
      // fetch send all shares
      assert.equal(Number(await stake.balanceOf(fetch.address)), 0)
      // fetch send all ETH remains
      assert.equal(Number(await web3.eth.getBalance(fetch.address)), 0)
      // fetch send all WETH remains
      assert.equal(Number(await weth.balanceOf(fetch.address)), 0)
      // fetch send all token
      assert.equal(Number(await token.balanceOf(fetch.address)), 0)
      // user should receive tokens
      assert.notEqual(Number(await stake.balanceOf(userTwo)), 0)
      // user should receive token shares
      const stakePool = Number(await wtoken.balanceOf(stake.address))
      const burnPool = Number(await wtoken.balanceOf("0x000000000000000000000000000000000000dEaD"))
      // stake should receive pool
      assert.notEqual(stakePool, 0)
      // burn address should receive tokens
      assert.notEqual(burnPool, 0)
      // stake should get more tahn burn
      assert.isTrue(stakePool > burnPool)
      // burn shoukd get 5% now
      assert.equal(
        Number(fromWei(String(stakePool))).toFixed(4),
        Number(fromWei(String(burnPool * 19))).toFixed(4),
      )
    })
  })

describe('Update stakes addresses in fetch', function() {
    it('Not owner can not call changeStakeAddress', async function() {
      const stakeAddressBefore = await fetch.stakeAddress()

      await fetch.changeStakeAddress(
        stakeSecond.address,
        { from:userTwo }
      ).should.be.rejectedWith(EVMRevert)

      assert.equal(await fetch.stakeAddress(), stakeAddressBefore)
    })

    it('Owner can call changeStakeAddress and fetch works with new address', async function() {
      // update address
      await fetch.changeStakeAddress(stakeSecond.address)
      assert.equal(await fetch.stakeAddress(), stakeSecond.address)

      // test new stake
      // user two not hold any pool before deposit
      assert.equal(Number(await wtoken.balanceOf(userTwo)), 0)
      // stake don't have any pool yet
      assert.equal(Number(await wtoken.balanceOf(stakeSecond.address)), 0)
      // deposit
      await fetch.deposit({ from:userTwo, value:toWei(String(1)) })
      // fetch send all pool
      assert.equal(Number(await wtoken.balanceOf(fetch.address)), 0)
      // fetch send all shares
      assert.equal(Number(await stakeSecond.balanceOf(fetch.address)), 0)
      // fetch send all ETH remains
      assert.equal(Number(await web3.eth.getBalance(fetch.address)), 0)
      // fetch send all WETH remains
      assert.equal(Number(await weth.balanceOf(fetch.address)), 0)
      // fetch send all token
      assert.equal(Number(await token.balanceOf(fetch.address)), 0)
      // user should receive tokens
      assert.notEqual(Number(await stakeSecond.balanceOf(userTwo)), 0)
      // user should receive token shares
      const stakePool = Number(await wtoken.balanceOf(stakeSecond.address))
      const burnPool = Number(await wtoken.balanceOf("0x000000000000000000000000000000000000dEaD"))
      // stake should receive pool
      assert.notEqual(stakePool, 0)
      // burn address should receive tokens
      assert.notEqual(burnPool, 0)
      // stake should get more tahn burn
      assert.isTrue(stakePool > burnPool)
      // burn shoukd get 10% by default
      assert.equal(
        Number(fromWei(String(stakePool))).toFixed(4),
        Number(fromWei(String(burnPool * 9))).toFixed(4),
      )
    })
  })

describe('DEPOSIT ONLY BNB(ETH)', function() {
    it('Convert input to pool and stake via token fetch and fetch split with DEX and SELL and send all shares and remains back to user and burn 10% of pool', async function() {
      const tokenOnSaleBefore = Number(await token.balanceOf(sale.address))
      const saleBeneficiaryBefore = Number(await web3.eth.getBalance(userOne))

      // user two not hold any pool before deposit
      assert.equal(Number(await wtoken.balanceOf(userTwo)), 0)
      // stake don't have any pool yet
      assert.equal(Number(await wtoken.balanceOf(stake.address)), 0)
      // deposit
      await fetch.deposit({ from:userTwo, value:toWei(String(1)) })
      // fetch send all pool
      assert.equal(Number(await wtoken.balanceOf(fetch.address)), 0)
      // fetch send all shares
      assert.equal(Number(await stake.balanceOf(fetch.address)), 0)
      // fetch send all ETH remains
      assert.equal(Number(await web3.eth.getBalance(fetch.address)), 0)
      // fetch send all WETH remains
      assert.equal(Number(await weth.balanceOf(fetch.address)), 0)
      // fetch send all token
      assert.equal(Number(await token.balanceOf(fetch.address)), 0)
      // user should receive token shares
      assert.notEqual(Number(await stake.balanceOf(userTwo)), 0)
      // user should receive tokens
      assert.notEqual(Number(await stake.balanceOf(userTwo)), 0)
      // user should receive token shares
      const stakePool = Number(await wtoken.balanceOf(stake.address))
      const burnPool = Number(await wtoken.balanceOf("0x000000000000000000000000000000000000dEaD"))
      // stake should receive pool
      assert.notEqual(stakePool, 0)
      // burn address should receive tokens
      assert.notEqual(burnPool, 0)
      // stake should get more tahn burn
      assert.isTrue(stakePool > burnPool)
      // burn shoukd get 10% by default
      assert.equal(
        Number(fromWei(String(stakePool))).toFixed(4),
        Number(fromWei(String(burnPool * 9))).toFixed(4),
      )

      // benificiary receive ETH
      assert.isTrue(Number(await web3.eth.getBalance(userOne)) > saleBeneficiaryBefore)
      // sale send tokens
      assert.isTrue(tokenOnSaleBefore > Number(await token.balanceOf(sale.address)))
    })

    it('User claim correct rewards and pool amount after exit', async function() {
      // user not hold any pool
      assert.equal(Number(await wtoken.balanceOf(userTwo)), 0)
      // deposit
      await fetch.deposit({ from:userTwo, value:toWei(String(1)) })
      // get staked amount
      const staked = await wtoken.balanceOf(stake.address)
      // staked should be more than 0
      assert.isTrue(staked > 0)

      await timeMachine.advanceTimeAndBlock(stakeDuration)
      // get user shares
      const shares = await stake.balanceOf(userTwo)

      // estimate rewards
      const estimateReward = await stake.earnedByShare(shares)
      assert.isTrue(estimateReward > 0)

      // withdraw
      await stake.exit({ from:userTwo })

      // user should get reward
      // with take into account sub burn fee
      assert.equal(
        fromWei(await token.balanceOf(userTwo)),
        fromWei(estimateReward)
      )

      // user get pool
      assert.equal(Number(await wtoken.balanceOf(userTwo)), staked)
      // stake send all
      assert.equal(Number(await wtoken.balanceOf(stake.address)), 0)
    })
  })
  //END
})
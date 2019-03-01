// import { promisify } from 'bluebird'
import ethers from 'ethers'

import getProvider from './provider'
import { state, updateState } from './state'
import { handleError, timeouts, assistLog } from './utilities'

const provider = getProvider()

export function checkForWallet() {
  if (window.ethereum) {
    updateState({
      currentProvider: getCurrentProvider(),
      validBrowser: true,
      web3Wallet: true,
      legacyWallet: false,
      modernWallet: true
    })
  } else if (window.web3) {
    updateState({
      currentProvider: getCurrentProvider(),
      validBrowser: true,
      web3Wallet: true,
      legacyWallet: true,
      modernWallet: false
    })
  } else {
    updateState({
      web3Wallet: false,
      accessToAccounts: false,
      walletLoggedIn: false,
      walletEnabled: false
    })
  }
}

export function getNetworkId() {
  return new Promise(async (resolve, reject) => {
    const { chainId } = await provider.getNetwork().catch(reject)
    resolve(chainId)
  })
}

export function getNonce(address) {
  return new Promise(async (resolve, reject) => {
    const nonce = await provider.getTransactionCount(address).catch(reject)
    resolve(nonce)
  })
}

export function hasSufficientBalance(
  txObject = {},
  contract,
  contractMethodName,
  methodArgs
) {
  return new Promise(async (resolve, reject) => {
    assistLog('checking has sufficient balance')
    const transactionValue = ethers.utils.bigNumberify(txObject.value || '0')
    const gasPrice = ethers.utils.bigNumberify(txObject.gasPrice || '0')
    assistLog({ methodArgs })
    assistLog({ contractMethodName })
    const gas = contract
      ? await contract.estimate[contractMethodName](...methodArgs)
      : await provider.getSigner().estimateGas(txObject)

    assistLog('gasEstimate: ')
    assistLog(gas.toString())

    const transactionFee = gas.mul(gasPrice)
    assistLog('transaction fee estimate')
    assistLog(transactionFee.toString())
    const buffer = transactionFee.div(ethers.utils.bigNumberify('10'))

    const totalTransactionCost = transactionFee
      .add(transactionValue)
      .add(buffer)

    assistLog({ totalTransactionCost })

    const accountBalance = await getAccountBalance().catch(
      handleError('web3', reject)
    )

    assistLog({ accountBalance })

    const sufficientBalance = accountBalance.gt(totalTransactionCost)

    const transactionParams = {
      value: transactionValue.toString(),
      gas: gas.toString(),
      gasPrice: gasPrice.toString(),
      to: txObject.to
    }

    resolve({ transactionParams, sufficientBalance })
  })
}

export function getAccountBalance() {
  return new Promise(async (resolve, reject) => {
    const accounts = await getAccounts()
    const balance = await provider.getBalance(accounts[0]).catch(reject)

    resolve(balance)
  })
}

export function getAccounts() {
  return new Promise(async (resolve, reject) => {
    const accounts = await provider.listAccounts().catch(reject)
    resolve(accounts)
    updateState({ accountAddress: accounts[0] })
  })
}

export function checkUnlocked() {
  return window.ethereum._metamask.isUnlocked()
}

export function requestLoginEnable() {
  return window.ethereum.enable()
}

export function getCurrentProvider() {
  const { web3 } = window
  if (web3 && web3.currentProvider.isMetaMask) {
    return 'metamask'
  }
  if (web3 && web3.currentProvider.isTrust) {
    return 'trust'
  }
  if (typeof window.SOFA !== 'undefined') {
    return 'toshi'
  }
  if (typeof window.__CIPHER__ !== 'undefined') {
    return 'cipher'
  }
  if (web3 && web3.currentProvider.constructor.name === 'EthereumProvider') {
    return 'mist'
  }
  if (web3 && web3.currentProvider.constructor.name === 'Web3FrameProvider') {
    return 'parity'
  }
  if (
    web3 &&
    web3.currentProvider.host &&
    web3.currentProvider.host.indexOf('infura') !== -1
  ) {
    return 'infura'
  }
  if (
    web3 &&
    web3.currentProvider.host &&
    web3.currentProvider.host.indexOf('localhost') !== -1
  ) {
    return 'localhost'
  }
  if (web3 && web3.currentProvider.connection) {
    return 'Infura Websocket'
  }

  return undefined
}

// Poll for a tx receipt
export function waitForTransactionReceipt(txHash) {
  const web3 = state.web3Instance || window.web3
  return new Promise((resolve, reject) => {
    function checkForReceipt() {
      web3.eth.getTransactionReceipt(txHash, (err, res) => {
        if (err) {
          return reject(err)
        }
        if (res === null) {
          return setTimeout(() => checkForReceipt(), timeouts.pollForReceipt)
        }
        return resolve(res)
      })
    }
    checkForReceipt()
  })
}

import '@babel/polyfill'
import { promisify } from 'bluebird'
import ethers from 'ethers'
import { state, updateState } from './helpers/state'
import { handleEvent } from './helpers/events'
import decorateContractMethod from './logic/contract-methods'
import { openWebsocketConnection } from './helpers/websockets'
import { getUserAgent } from './helpers/browser'
import { checkUserEnvironment, prepareForTransaction } from './logic/user'
import sendTransaction from './logic/send-transaction'
import { createIframe } from './helpers/iframe'
import {
  getTransactionQueueFromStorage,
  storeTransactionQueue
} from './helpers/storage'
import styles from '../css/styles.css'
import getProvider from './helpers/provider'
import { assistLog } from './helpers/utilities'

// Library Version - if changing, also need to change in package.json
const version = '0.3.4'

function init(config) {
  updateState({ version })

  openWebsocketConnection()

  // Make sure we have a config object
  if (!config || typeof config !== 'object') {
    const reason = 'A config object is needed to initialize assist'

    handleEvent({
      eventCode: 'initFail',
      categoryCode: 'initialize',
      reason
    })

    const errorObj = new Error(reason)
    errorObj.eventCode = 'initFail'
    throw errorObj
  } else {
    updateState({ config })
  }

  const { dappId, mobileBlocked } = config

  // Check that an api key has been provided to the config object
  if (!dappId) {
    handleEvent({
      eventCode: 'initFail',
      categoryCode: 'initialize',
      reason: 'No API key provided to init function'
    })

    updateState({
      validApiKey: false
    })

    const errorObj = new Error('API key is required')
    errorObj.eventCode = 'initFail'
    throw errorObj
  }

  // Get browser info
  getUserAgent()

  // Commit a cardinal sin and create an iframe (to isolate the CSS)
  if (!state.iframe) {
    createIframe(document, styles)
  }

  // Check if on mobile and mobile is blocked
  if (state.mobileDevice && mobileBlocked) {
    handleEvent({ eventCode: 'mobileBlocked', categoryCode: 'initialize' })
    updateState({ validBrowser: false })
  }

  // Get transactionQueue from storage if it exists
  getTransactionQueueFromStorage()

  // Add unload event listener
  window.addEventListener('unload', storeTransactionQueue)

  // Public API to expose
  const intializedAssist = {
    onboard,
    Contract,
    Transaction,
    getState
  }

  // return the API
  return intializedAssist

  // ========== API FUNCTIONS ========== //

  // ONBOARD FUNCTION //

  function onboard() {
    if (state.config.headlessMode) {
      return new Promise(async (resolve, reject) => {
        await checkUserEnvironment().catch(reject)

        if (state.mobileDevice) {
          const error = new Error('User is on a mobile device')
          error.eventCode = 'mobileBlocked'
          reject(error)
        }

        if (!state.validBrowser) {
          const error = new Error('User has an invalid browser')
          error.eventCode = 'browserFail'
          reject(error)
        }

        if (!state.web3Wallet) {
          const error = new Error('User does not have a web3 wallet installed')
          error.eventCode = 'walletFail'
          reject(error)
        }

        if (!state.accessToAccounts) {
          if (state.legacyWallet) {
            const error = new Error('User needs to login to their account')
            error.eventCode = 'walletLogin'
            reject(error)
          }

          if (state.modernWallet) {
            if (!state.walletLoggedIn) {
              const error = new Error('User needs to login to wallet')
              error.eventCode = 'walletLoginEnable'
              reject(error)
            }

            if (!state.walletEnabled) {
              const error = new Error('User needs to enable wallet')
              error.eventCode = 'walletEnable'
              reject(error)
            }
          }
        }

        if (!state.correctNetwork) {
          const error = new Error('User is on the wrong network')
          error.eventCode = 'networkFail'
          reject(error)
        }

        if (!state.minimumBalance) {
          const error = new Error(
            'User does not have the minimum balance specified in the config'
          )
          error.eventCode = 'nsfFail'
          reject(error)
        }

        resolve('User is ready to transact')
      })
    }

    if (!state.validApiKey) {
      const errorObj = new Error('Your api key is not valid')
      errorObj.eventCode = 'initFail'
      return Promise.reject(errorObj)
    }

    if (!state.supportedNetwork) {
      const errorObj = new Error('This network is not supported')
      errorObj.eventCode = 'initFail'
      return Promise.reject(errorObj)
    }

    // If user is on mobile, warn that it isn't supported
    if (state.mobileDevice) {
      return new Promise((resolve, reject) => {
        handleEvent(
          { eventCode: 'mobileBlocked', categoryCode: 'onboard' },
          {
            onClose: () => {
              const errorObj = new Error('User is on a mobile device')
              errorObj.eventCode = 'mobileBlocked'
              reject(errorObj)
            }
          }
        )

        updateState({ validBrowser: false })
      })
    }

    return new Promise(async (resolve, reject) => {
      const ready = await prepareForTransaction('onboard').catch(reject)
      resolve(ready)
    })
  }

  // CONTRACT FUNCTION //

  function Contract(contractObj) {
    if (!state.validApiKey) {
      const errorObj = new Error('Your API key is not valid')
      errorObj.eventCode = 'initFail'
      throw errorObj
    }

    if (!state.supportedNetwork) {
      const errorObj = new Error('This network is not supported')
      errorObj.eventCode = 'initFail'
      throw errorObj
    }

    // if user is on mobile, and mobile is allowed by Dapp then just pass the contract back
    if (state.mobileDevice && !config.mobileBlocked) {
      return contractObj
    }

    const abi =
      contractObj.abi ||
      contractObj._jsonInterface ||
      Object.keys(contractObj.abiModel.abi.methods).map(
        key => contractObj.abiModel.abi.methods[key].abiItem
      )

    assistLog({ contractObj })

    const address = contractObj.address || contractObj._address
    const provider = getProvider()
    const signer = provider.getSigner()
    const ethersContract = new ethers.Contract(address, abi, signer)
    const contractKeys = Object.keys(ethersContract)

    const decoratedContract = contractKeys.reduce((contract, key) => {
      const methodABI = abi.find(method => method.name === key)
      const method = ethersContract[key]

      // if not a contract method from abi then we don't do anything to it, just copy it over
      if (!methodABI) {
        contract[key] = ethersContract[key]
      } else if (method) {
        // ethers/web3.js 0.20 call and send
        contract[key] = (...args) =>
          decorateContractMethod(ethersContract, methodABI, args)

        // web3.js 0.20 call
        contract[key].call = (...args) =>
          decorateContractMethod(ethersContract, methodABI, args)

        // web3.js 0.20 send
        contract[key].sendTransaction = (...args) =>
          decorateContractMethod(ethersContract, methodABI, args)

        if (!contract.methods) {
          contract.methods = {}
        }

        // web3.js 1.0 call and send
        contract.methods = Object.assign({}, contract.methods, {
          [key]: (...args) => ({
            call: () => decorateContractMethod(ethersContract, methodABI, args),
            send: (txObject = {}) =>
              decorateContractMethod(ethersContract, methodABI, [
                ...args,
                txObject
              ])
          })
        })
      }

      return contract
    }, Object.create(Object.getPrototypeOf(ethersContract)))

    assistLog({ decoratedContract })

    return decoratedContract
  }

  // TRANSACTION FUNCTION //

  function Transaction(txObject, callback) {
    if (!state.validApiKey) {
      const errorObj = new Error('Your api key is not valid')
      errorObj.eventCode = 'initFail'
      return Promise.reject(errorObj)
    }

    if (!state.supportedNetwork) {
      const errorObj = new Error('This network is not supported')
      errorObj.eventCode = 'initFail'
      return Promise.reject(errorObj)
    }

    // if user is on mobile, and mobile is allowed by Dapp just put the transaction through
    if (state.mobileDevice && !state.config.mobileBlocked) {
      return state.web3Instance.eth.sendTransaction(txObject)
    }

    const sendMethod = state.legacyWeb3
      ? promisify(state.web3Instance.eth.sendTransaction)
      : state.web3Instance.eth.sendTransaction

    return new Promise(async (resolve, reject) => {
      const txPromiseObj = await sendTransaction(
        'activeTransaction',
        txObject,
        sendMethod,
        callback
      ).catch(errorObj => {
        reject(errorObj)
        callback && callback(errorObj)
      })
      resolve(txPromiseObj)
    })
  }

  // GETSTATE FUNCTION //

  function getState() {
    return new Promise(async (resolve, reject) => {
      await checkUserEnvironment().catch(reject)
      resolve(state)
    })
  }
}

export default { init }

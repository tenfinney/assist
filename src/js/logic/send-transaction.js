import ethers from 'ethers'
import { state, updateState } from '../helpers/state'
import { handleEvent } from '../helpers/events'
import { prepareForTransaction } from './user'
import { hasSufficientBalance, getNonce } from '../helpers/web3'
import {
  isDuplicateTransaction,
  checkTransactionQueue,
  removeTransactionFromQueue,
  getTransactionObj,
  addTransactionToQueue,
  timeouts,
  extractMessageFromError,
  handleError
} from '../helpers/utilities'

function inferNonce() {
  return new Promise(async (resolve, reject) => {
    const currentNonce = await getNonce(state.accountAddress).catch(
      handleError('web3', reject)
    )
    const pendingTransactions =
      (state.transactionQueue && state.transactionQueue.length) || 0
    resolve(pendingTransactions + currentNonce)
  })
}

function sendTransaction(
  categoryCode,
  txObject = {},
  sendTransactionMethod,
  callback,
  contract,
  contractEventObj
) {
  return new Promise(async (resolve, reject) => {
    // Prepare for transaction
    try {
      await prepareForTransaction('activePreflight')
    } catch (errorObj) {
      reject(errorObj)
      return
    }

    if (txObject.from) {
      delete txObject.from
    }

    if (txObject.gasPrice) {
      txObject.gasPrice = ethers.utils.parseUnits(txObject.gasPrice, 'wei')
    }

    if (txObject.value) {
      txObject.value = ethers.utils.parseUnits(txObject.value, 'wei')
    }

    // Get the total transaction cost and see if there is enough balance
    const { sufficientBalance, transactionParams } = await hasSufficientBalance(
      txObject,
      contract,
      contractEventObj.methodName,
      contractEventObj.parameters
    ).catch(reject)

    if (!sufficientBalance) {
      handleEvent({
        eventCode: 'nsfFail',
        categoryCode: 'activePreflight',
        transaction: transactionParams,
        wallet: {
          provider: state.currentProvider,
          address: state.accountAddress,
          balance: state.accountBalance,
          minimum: state.config.minimumBalance
        }
      })
      const errorObj = new Error(
        'User has insufficient funds to complete transaction'
      )
      errorObj.eventCode = 'nsfFail'
      reject(errorObj)
      return
    }

    const duplicateTransaction = isDuplicateTransaction(transactionParams)
    if (duplicateTransaction) {
      handleEvent(
        addContractEventObj(
          {
            eventCode: 'txRepeat',
            categoryCode: 'activePreflight',
            transaction: transactionParams,
            wallet: {
              provider: state.currentProvider,
              address: state.accountAddress,
              balance: state.accountBalance,
              minimum: state.config.minimumBalance
            }
          },
          contractEventObj
        )
      )
    }

    if (state.transactionAwaitingApproval) {
      handleEvent(
        addContractEventObj(
          {
            eventCode: 'txAwaitingApproval',
            categoryCode: 'activePreflight',
            transaction: transactionParams,
            wallet: {
              provider: state.currentProvider,
              address: state.accountAddress,
              balance: state.accountBalance,
              minimum: state.config.minimumBalance
            }
          },
          contractEventObj
        )
      )
    }

    const txPromise = contract
      ? contract[contractEventObj.methodName](
          ...contractEventObj.parameters,
          txObject
        )
      : sendTransactionMethod(txObject)

    resolve({ txPromise })

    handleEvent(
      addContractEventObj(
        {
          eventCode: 'txRequest',
          categoryCode,
          transaction: transactionParams,
          wallet: {
            provider: state.currentProvider,
            address: state.accountAddress,
            balance: state.accountBalance,
            minimum: state.config.minimumBalance
          }
        },
        contractEventObj
      )
    )

    updateState({ transactionAwaitingApproval: true })

    let rejected
    let confirmed

    // Check if user has confirmed transaction after 20 seconds
    setTimeout(async () => {
      const nonce = await inferNonce().catch(reject)
      if (!checkTransactionQueue(nonce) && !rejected && !confirmed) {
        handleEvent(
          addContractEventObj(
            {
              eventCode: 'txConfirmReminder',
              categoryCode,
              transaction: transactionParams,
              wallet: {
                provider: state.currentProvider,
                address: state.accountAddress,
                balance: state.accountBalance,
                minimum: state.config.minimumBalance
              }
            },
            contractEventObj
          )
        )
      }
    }, timeouts.txConfirmReminder)

    const tx = await txPromise.catch(async errorObj => {
      rejected = handleTxError(
        errorObj,
        { transactionParams, categoryCode, contractEventObj },
        reject,
        callback
      )
    })

    confirmed = handleTxHash(
      tx.hash,
      { transactionParams, categoryCode, contractEventObj },
      reject,
      callback
    )

    const txReceipt = await tx.wait()

    handleTxReceipt(
      txReceipt,
      { transactionParams, categoryCode, contractEventObj },
      reject,
      callback
    )
  })
}

async function handleTxHash(txHash, meta, reject, callback) {
  const nonce = await inferNonce().catch(reject)
  const { transactionParams, categoryCode, contractEventObj } = meta

  onResult(transactionParams, nonce, categoryCode, contractEventObj, txHash)
  callback && callback(null, txHash)
  return true // confirmed
}

async function handleTxReceipt(receipt, meta, reject, callback) {
  const { transactionHash } = receipt
  const txObj = getTransactionObj(transactionHash)
  const nonce = await inferNonce().catch(reject)
  const { transactionParams, categoryCode, contractEventObj } = meta

  handleEvent(
    addContractEventObj(
      {
        eventCode: 'txConfirmedClient',
        categoryCode,
        transaction:
          (txObj && txObj.transaction) ||
          Object.assign({}, transactionParams, {
            hash: transactionHash,
            nonce
          }),
        wallet: {
          provider: state.currentProvider,
          address: state.accountAddress,
          balance: state.accountBalance,
          minimum: state.config.minimumBalance
        }
      },
      contractEventObj
    )
  )

  callback && callback(null, receipt)

  updateState({
    transactionQueue: removeTransactionFromQueue(
      (txObj && txObj.transaction.nonce) || nonce
    )
  })
}

async function handleTxError(error, meta, reject, callback) {
  const { message } = error
  let errorMsg
  try {
    errorMsg = extractMessageFromError(message)
  } catch (error) {
    errorMsg = 'User denied transaction signature'
  }

  const nonce = await inferNonce().catch(reject)
  const { transactionParams, categoryCode, contractEventObj } = meta
  handleEvent(
    addContractEventObj(
      {
        eventCode:
          errorMsg === 'transaction underpriced'
            ? 'txUnderpriced'
            : 'txSendFail',
        categoryCode,
        transaction: Object.assign({}, transactionParams, {
          nonce
        }),
        reason: 'User denied transaction signature',
        wallet: {
          provider: state.currentProvider,
          address: state.accountAddress,
          balance: state.accountBalance,
          minimum: state.config.minimumBalance
        }
      },
      contractEventObj
    )
  )

  updateState({ transactionAwaitingApproval: false })

  const errorObj = new Error(
    errorMsg === 'transaction underpriced'
      ? 'Transaction is underpriced'
      : 'User denied transaction signature'
  )
  errorObj.eventCode =
    errorMsg === 'transaction underpriced' ? 'txUnderpriced' : 'txSendFail'

  callback && callback(errorObj)
  reject(errorObj)

  return true // rejected
}

function addContractEventObj(eventObj, contractEventObj) {
  if (contractEventObj) {
    return Object.assign({}, eventObj, { contract: contractEventObj })
  }
  return eventObj
}

// On result handler
function onResult(
  transactionParams,
  nonce,
  categoryCode,
  contractEventObj,
  hash
) {
  const transaction = Object.assign({}, transactionParams, {
    hash,
    nonce,
    startTime: Date.now(),
    txSent: true,
    inTxPool: false
  })

  handleEvent(
    addContractEventObj(
      {
        eventCode: 'txSent',
        categoryCode,
        transaction,
        wallet: {
          provider: state.currentProvider,
          address: state.accountAddress,
          balance: state.accountBalance,
          minimum: state.config.minimumBalance
        }
      },
      contractEventObj
    )
  )

  updateState({
    transactionQueue: addTransactionToQueue({
      contract: contractEventObj,
      transaction
    }),
    transactionAwaitingApproval: false
  })

  // Check if transaction is in txPool
  setTimeout(() => {
    const transactionObj = getTransactionObj(transaction.hash)
    if (
      transactionObj &&
      !transactionObj.transaction.inTxPool &&
      state.socketConnection
    ) {
      handleEvent(
        addContractEventObj(
          {
            eventCode: 'txStall',
            categoryCode,
            transaction,
            wallet: {
              provider: state.currentProvider,
              address: state.accountAddress,
              balance: state.accountBalance,
              minimum: state.config.minimumBalance
            }
          },
          contractEventObj
        )
      )
    }
  }, timeouts.txStall)
}

export default sendTransaction

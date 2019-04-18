import { promisify } from 'bluebird'

import { state } from '../helpers/state'
import { handleEvent } from '../helpers/events'
import { timeouts, handleError } from '../helpers/utilities'

function signMessage(message, address, inlineCustomMsgs, callback) {
  return new Promise(async (resolve, reject) => {
    const { legacyWeb3, web3Instance } = state

    handleEvent({
      eventCode: 'signRequest',
      categoryCode: 'activeSign',
      messageToSign: message,
      inlineCustomMsgs
    })

    let result
    let rejected

    if (legacyWeb3) {
      result = await promisify(web3Instance.eth.sign)(address, message).catch(
        error => {
          onSignError(error, inlineCustomMsgs)
          handleError({ resolve, reject, callback })(error)
        }
      )
    } else {
      result = await web3Instance.eth
        .sign(message, address, '')
        .catch(error => {
          onSignError(error, inlineCustomMsgs)
          handleError({ resolve, reject, callback })(error)
        })
    }

    setTimeout(() => {
      if (!result && !rejected) {
        handleEvent({
          eventCode: 'signConfirmReminder',
          categoryCode: 'activeSign',
          messageToSign: message,
          inlineCustomMsgs
        })
      }
    }, timeouts.signConfirmReminder)

    if (result) {
      resolve(result)
      callback && callback(null, result)

      handleEvent({
        eventCode: 'signConfirm',
        categoryCode: 'activeSign',
        messageToSign: message,
        inlineCustomMsgs,
        result
      })
    }
  })
}

function onSignError(error, inlineCustomMsgs) {
  const { message } = error

  handleEvent({
    eventCode: 'signReject',
    categoryCode: 'activeSign',
    inlineCustomMsgs,
    reason: message
  })
}

export default signMessage

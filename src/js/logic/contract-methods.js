import { state } from '../helpers/state'
import { handleEvent } from '../helpers/events'
import sendTransaction from './send-transaction'
import { separateArgs, timeouts, assistLog } from '../helpers/utilities'
import { checkNetwork } from './user'
import { addOnboardWarning } from '../views/dom'

export default function decorateContractMethod(contract, methodABI, allArgs) {
  return new Promise(async (resolve, reject) => {
    const { name, constant } = methodABI
    assistLog({ allArgs })

    const { args, txObject = {}, callback } = separateArgs(allArgs)
    assistLog({ args })
    assistLog({ txObject })
    if (state.mobileDevice && state.config.mobileBlocked) {
      handleEvent(
        {
          eventCode: 'mobileBlocked',
          categoryCode: 'activePreflight'
        },
        {
          onClose: () => {
            const errorObj = new Error('User is on a mobile device')
            errorObj.eventCode = 'mobileBlocked'
            reject(errorObj)
          }
        }
      )
    }

    assistLog({ methodABI })

    if (constant) {
      const txPromise = contract[name](...args, txObject)

      txPromise
        .then(result => {
          handleEvent({
            eventCode: 'contractQuery',
            categoryCode: 'activeContract',
            contract: {
              methodName: name,
              parameters: args,
              result: JSON.stringify(result)
            }
          })
          callback && callback(null, result)
          assistLog({ result })
          resolve(result)
        })
        .catch(() => {
          handleEvent(
            {
              eventCode: 'contractQueryFail',
              categoryCode: 'activeContract',
              contract: {
                methodName: name,
                parameters: args
              },
              reason: 'User is on the incorrect network'
            },
            {
              onClose: () =>
                setTimeout(() => {
                  const errorObj = new Error('User is on the wrong network')
                  errorObj.eventCode = 'networkFail'
                  reject(errorObj)
                }, timeouts.changeUI),
              onClick: async () => {
                await checkNetwork()
                if (!state.correctNetwork) {
                  addOnboardWarning('network')
                }
              }
            }
          )
        })
    } else {
      const txPromiseObj = await sendTransaction(
        'activeContract',
        txObject,
        callback,
        null,
        contract,
        {
          methodName: name,
          parameters: args
        }
      ).catch(reject)

      resolve(txPromiseObj)
    }
  })
}

import ethers from 'ethers'

import { state } from './state'
import { networkName } from './utilities'

let provider

export default function getProvider() {
  if (!provider) {
    if (typeof window.ethereum !== 'undefined') {
      provider = new ethers.providers.Web3Provider(window.ethereum)
    } else if (typeof window.web3 !== 'undefined') {
      provider = new ethers.providers.Web3Provider(window.web3.currentProvider)
    } else {
      provider = ethers.getDefaultProvider(networkName(state.config.networkId))
    }
  }

  return provider
}

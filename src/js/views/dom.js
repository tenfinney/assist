import { state } from '~/js/helpers/state'
import {
  capitalize,
  timeString,
  timeouts,
  stepToImageKey,
  first
} from '~/js/helpers/utilities'
import { showIframe, hideIframe, resizeIframe } from '~/js/helpers/iframe'

import {
  onboardHeading,
  onboardDescription,
  onboardButton,
  imageSrc,
  notSupported,
  onboardWarningMsg
} from './content'

// Update UI styles based on the current style.notificationsPosition value
export function updateNotificationsPosition() {
  const { notificationsPosition } = state.config.style
  if (!notificationsPosition) return
  positionElement(state.iframe)

  // Position notificationsContainer and reorder it's elements
  const notificationsContainer = state.iframeDocument.getElementById(
    'blocknative-notifications'
  )
  if (notificationsContainer) {
    const brand = notificationsContainer.querySelector(
      '#bn-transaction-branding'
    )
    const scroll = notificationsContainer.querySelector(
      '.bn-notifications-scroll'
    )
    if (notificationsPosition.includes('top')) {
      notificationsContainer.insertBefore(brand, scroll)
    } else {
      notificationsContainer.insertBefore(scroll, brand)
    }
    positionElement(notificationsContainer)
  }

  // Update existing status-icon positions
  const statusIcons = [
    ...state.iframeDocument.getElementsByClassName('bn-status-icon')
  ]
  statusIcons.forEach(icon => {
    notificationsPosition.includes('Left')
      ? icon.classList.add('bn-float-right')
      : icon.classList.remove('bn-float-right')
  })

  // Update existing progress tooltip positions
  const progressTooltips = [
    ...state.iframeDocument.getElementsByClassName('progress-tooltip')
  ]
  progressTooltips.forEach(tooltip => {
    notificationsPosition.includes('Left')
      ? tooltip.classList.add('bn-left')
      : tooltip.classList.remove('bn-left')
  })

  // Update brand position
  const brand = state.iframeDocument.getElementById('bn-transaction-branding')
  if (brand) {
    notificationsPosition.includes('Left')
      ? (brand.style.float = 'initial')
      : (brand.style.float = 'right')
  }

  // Update existing notifications borders
  const notifications = [
    ...state.iframeDocument.getElementsByClassName('bn-notification')
  ]
  notifications.forEach(n => {
    notificationsPosition.includes('Left')
      ? n.classList.add('bn-right-border')
      : n.classList.remove('bn-right-border')
  })

  // Update notifications-scroll position
  const scrolls = [
    ...state.iframeDocument.getElementsByClassName('bn-notifications-scroll')
  ]
  scrolls.forEach(s => {
    notificationsPosition === 'topRight'
      ? (s.style.float = 'right')
      : delete s.style.float
  })
}

export function createElementString(type, className, innerHTML) {
  return `
	  <${type} class="${className}">
	    ${innerHTML}
	  </${type}>
	`
}

export function createElement(el, className, children, id) {
  const element = state.iframeDocument.createElement(el)
  element.className = className || ''

  if (children && typeof children === 'string') {
    element.innerHTML = children
  }

  if (children && typeof children === 'object') {
    element.appendChild(children)
  }

  if (id) {
    element.id = id
  }

  return element
}

const handleWindowResize = () =>
  resizeIframe({ height: window.innerHeight, width: window.innerWidth })

export function closeModal() {
  window.removeEventListener('resize', handleWindowResize)
  const modal = state.iframeDocument.querySelector('.bn-onboard-modal-shade')
  modal.style.opacity = '0'
  removeTouchHandlers(modal)

  const notifications = getById('blocknative-notifications')
  if (notifications) {
    resizeIframe({
      height: notifications.clientHeight,
      width: notifications.clientWidth
    })
  } else {
    hideIframe()
    resizeIframe({ height: 0, width: 0 })
  }

  setTimeout(() => {
    state.iframeDocument.body.removeChild(modal)
  }, timeouts.removeElement)
}

export function openModal(modal, handlers = {}) {
  const { onClick, onClose } = handlers
  window.addEventListener('resize', handleWindowResize)
  state.iframeDocument.body.appendChild(modal)
  showIframe()
  resizeIframe({ height: window.innerHeight, width: window.innerWidth })

  const closeButton = state.iframeDocument.querySelector('.bn-onboard-close')
  closeButton.onclick = () => {
    onClose && onClose()
    closeModal()
  }

  if (state.mobileDevice) {
    closeButton.ontouchstart = () => {
      onClick && onClick()
    }
  }

  const completeStepButton = modal.querySelector('.bn-btn')
  if (completeStepButton) {
    completeStepButton.onclick = () => {
      onClick && onClick()
    }

    if (state.mobileDevice) {
      completeStepButton.ontouchstart = () => {
        onClick && onClick()
      }
    }
  }

  setTimeout(() => {
    modal.style.opacity = '1'
  }, timeouts.endOfEventQueue)
}

export function notSupportedImage(type) {
  const imageUrl = imageSrc[type]
  return `
	  <img
	    src="${imageUrl.src}"
	    alt ="${capitalize(type)}Not Supported"
	    srcset="${imageUrl.srcset} 2x" />
  `
}

export function browserLogos() {
  const { chromeLogo, firefoxLogo } = imageSrc
  return `
    <p>
      <a href="https://www.google.com/chrome/" target="_blank" class="bn-btn bn-btn-primary bn-btn-outline text-center">
      <img
        src="${chromeLogo.src}" 
        alt="Chrome Logo" 
        srcset="${chromeLogo.srcset} 2x" />
      <br>
      Chrome
      </a>
      <a href="https://www.mozilla.org/en-US/firefox/" target="_blank" class="bn-btn bn-btn-primary bn-btn-outline text-center">
      <img
        src="${firefoxLogo.src}" 
        alt="Firefox Logo" 
        srcset="${firefoxLogo.srcset} 2x" />
      <br>
      Firefox
      </a>
    </p>
  `
}

function walletLogos() {
  const { trustLogo, coinbaseLogo } = imageSrc

  return `
    <p class="flex-row">
      <a href="https://links.trustwalletapp.com/a/key_live_lfvIpVeI9TFWxPCqwU8rZnogFqhnzs4D?&event=openURL&url=${
        window.location.href
      }" target="_blank" style="margin: 0 10px;" class="bn-btn bn-btn-primary bn-btn-outline text-center flex-column">
      <img
        src="${trustLogo.src}" 
        alt="Chrome Logo" 
        srcset="${trustLogo.srcset} 2x"
      />
      <br>
      Trust
      </a>
      <a href="https://go.cb-w.com/" target="_blank" style="margin: 0 10px;" class="bn-btn bn-btn-primary bn-btn-outline text-center flex-column">
      <img
        src="${coinbaseLogo.src}" 
        alt="Firefox Logo" 
        srcset="${coinbaseLogo.srcset} 2x"
      />
      <br>
      Coinbase
      </a>
    </p>
  `
}

export function onboardBranding() {
  const { blockNativeLogo, blockNativeLogoLight } = imageSrc
  const { style } = state.config
  const darkMode = style && style.darkMode

  return `
    <div class="bn-onboarding-branding">
      <p>Powered by
      <a href="https://www.blocknative.com/" target="_blank">
      <img
        src="${darkMode ? blockNativeLogoLight.src : blockNativeLogo.src}" 
        alt="Blocknative" 
        srcset="${
          darkMode ? blockNativeLogoLight.srcset : blockNativeLogo.srcset
        } 2x" />
      </a>
      </p>
    </div>
  `
}

export function notSupportedModal(type) {
  const info = notSupported[`${type}NotSupported`]
  const { style } = state.config
  const darkMode = style && style.darkMode
  const variant = darkMode ? 'Light' : ''

  return `
    <div id="bn-${type}-not-supported" class="bn-onboard">
      <div class="bn-onboard-modal bn-onboard-alert">
        <a href="#" class="bn-onboard-close">
          <span class="bn-onboard-close-x"></span>
        </a>
        ${notSupportedImage(type + variant)}
        <br><br>
        <h1 class="h4">${info.heading}</h1>
        <p>${info.description()}</p>
        <br>
        ${
          type === 'browser'
            ? browserLogos()
            : type === 'mobileWallet'
            ? walletLogos()
            : ''
        }
        <br>
        ${onboardBranding()}
      </div>
    </div>
  `
}

export function onboardSidebar(step) {
  return `
    <div class="bn-onboard-sidebar">
      <h4>Setup Tasks</h4>
      <ul class="bn-onboard-list">
        <li class=${
          step < 1 ? 'bn-inactive' : step > 1 ? 'bn-check' : 'bn-active'
        }>
          <span class="bn-onboard-list-sprite"></span> ${
            onboardHeading[1].basic
          }
        </li>
        <li class=${
          step < 2 ? 'bn-inactive' : step > 2 ? 'bn-check' : 'bn-active'
        }>
          <span class="bn-onboard-list-sprite"></span> ${
            onboardHeading[2].basic
          }
        </li>
        <li class=${
          step < 3 ? 'bn-inactive' : step > 3 ? 'bn-check' : 'bn-active'
        }>
          <span class="bn-onboard-list-sprite"></span> ${
            onboardHeading[3].basic
          }
        </li>
        <li class=${
          step < 4 ? 'bn-inactive' : step > 4 ? 'bn-check' : 'bn-active'
        }>
          <span class="bn-onboard-list-sprite"></span> ${
            onboardHeading[4].basic
          }
        </li>
        <li class=${
          step < 5 ? 'bn-inactive' : step > 5 ? 'bn-check' : 'bn-active'
        }>
          <span class="bn-onboard-list-sprite"></span> ${
            onboardHeading[5].basic
          }
        </li>
      </ul>
      ${onboardBranding()}
    </div>
  `
}

export function onboardMain(type, step) {
  const heading = onboardHeading[step][type]
  const description = onboardDescription[step][type]()
  const buttonText =
    typeof onboardButton[step][type] === 'function'
      ? onboardButton[step][type]()
      : onboardButton[step][type]

  const {
    config: { style }
  } = state

  const darkMode = style && style.darkMode
  const variant = darkMode ? 'Light' : ''

  const defaultImages = imageSrc[step + variant] || imageSrc[step]

  const { images } = state.config
  const stepKey = stepToImageKey(step)
  const devImages = images && images[stepKey]
  const onboardImages = {
    src: (devImages && devImages.src) || (defaultImages && defaultImages.src),
    srcset:
      (devImages && devImages.srcset && devImages.srcset) ||
      (defaultImages && defaultImages.srcset)
  }

  return `
    ${
      onboardImages.src
        ? `<img
      src="${(devImages && devImages.src) || defaultImages.src}" 
      class="bn-onboard-img" 
      alt="Blocknative" 
      srcset="${(devImages && devImages.srcset && devImages.srcset) ||
        defaultImages.srcset} 2x"/>`
        : ''
    }
    <br>
    <h1 class="h4">${heading}</h1>
    <p>${description}</p>
    <br>
    <br>
    <p class="bn-onboard-button-section">
      <a href="#"
         class="bn-btn bn-btn-primary bn-btn-outline">${buttonText}
      </a>
    </p>
  `
}

export function onboardModal(type, step) {
  return `
    <div id="bn-user-${type}" class="bn-onboard">
      <div class="bn-onboard-modal bn-onboard-${type} ${
    type === 'basic' ? 'clearfix' : ''
  }">
        <a href="#" class="bn-onboard-close">
          <span class="bn-onboard-close-x"></span>
        </a>
        ${type === 'basic' ? onboardSidebar(step) : ''}
				${
          type === 'basic'
            ? createElementString(
                'div',
                'bn-onboard-main',
                onboardMain(type, step)
              )
            : onboardMain(type, step)
        }
        ${type === 'advanced' ? `<br>${onboardBranding()}` : ''}
      </div>
    </div>
  `
}

export function addOnboardWarning(msgType) {
  const existingWarning = getByQuery('.bn-onboard-warning')
  if (existingWarning) {
    return
  }

  const warning = createElement(
    'span',
    'bn-onboard-warning',
    onboardWarningMsg(msgType)
  )

  const spacer = createElement('br')
  const basicModal = getByQuery('.bn-onboard-main')

  if (basicModal) {
    basicModal.appendChild(spacer)
    basicModal.appendChild(warning)
  } else {
    const modal = getByQuery('.bn-onboard-modal')
    const branding = modal.querySelector('.bn-onboarding-branding')
    modal.insertBefore(warning, branding)
  }
}

export function getById(id) {
  return state.iframeDocument.getElementById(id)
}

export function getByQuery(query) {
  return state.iframeDocument.querySelector(query)
}

export function getAllByQuery(query) {
  return Array.from(state.iframeDocument.querySelectorAll(query))
}

export function createTransactionBranding() {
  const position =
    (state.config.style && state.config.style.notificationsPosition) || ''

  const blockNativeBrand = createElement(
    'a',
    null,
    null,
    'bn-transaction-branding'
  )
  blockNativeBrand.href = 'https://www.blocknative.com/'
  blockNativeBrand.target = '_blank'
  if (state.mobileDevice) {
    blockNativeBrand.classList.add('mobile-margin')
  } else {
    if (position.includes('Left')) {
      blockNativeBrand.classList.add('align-start')
    }

    if (position.includes('top')) {
      blockNativeBrand.classList.add('margin-top')
    }
  }

  return blockNativeBrand
}

export function notificationContent(type, message, time = {}) {
  const { showTime, startTime, timeStamp } = time
  const elapsedTime = timeString(Date.now() - startTime)
  const position =
    (state.config.style && state.config.style.notificationsPosition) || ''

  return `
		<span class="bn-status-icon ${
      position.includes('Left') ? 'bn-float-right' : ''
    }">
      ${
        type === 'progress'
          ? `<div class="progress-tooltip ${
              position.includes('Left') ? 'bn-left' : ''
            }">
				<div class="progress-tooltip-inner">
					You will be notified when this transaction is completed.
				</div>
			</div>`
          : ''
      }
		</span>
		<div class="bn-notification-info">
			<p>${message}</p>
			<p class="bn-notification-meta">
				<a href="#" class="bn-timestamp">${timeStamp}</a>
				<span class="bn-duration${showTime ? '' : ' bn-duration-hidden'}"> - 
					<i class="bn-clock"></i>
					<span class="bn-duration-time">${elapsedTime}</span>
				</span>
      </p>
		</div>
	`
}

// Start clock
export function startTimerInterval(notificationId, eventCode, startTime) {
  const notification = first(
    getAllByQuery(`.bn-${notificationId}`).filter(n =>
      n.classList.contains(`bn-${eventCode}`)
    )
  )

  if (!notification) {
    return null
  }

  const intervalId = setInterval(() => {
    const timeContainer = notification.querySelector('.bn-duration')
    if (timeContainer.classList.contains('bn-duration-hidden')) {
      timeContainer.classList.remove('bn-duration-hidden')
    }

    const durationContainer = timeContainer.querySelector('.bn-duration-time')
    const elapsedTime = timeString(Date.now() - startTime)
    durationContainer.innerHTML = `${elapsedTime}`
  }, 1000)

  return intervalId
}

export function showElement(element, timeout) {
  setTimeout(() => {
    element.style.opacity = '1'
    element.style.transform = 'translateX(0)'
  }, timeout)
}

export function hideElement(element) {
  setTimeout(() => {
    element.style.opacity = '0'
    element.style.transform = `translate${
      state.mobileDevice ? 'Y' : 'X'
    }(${getPolarity()}${state.mobileDevice ? '150' : '600'}px)`
  }, timeouts.hideElement)
}

export function removeElement(parent, element) {
  setTimeout(() => {
    if (parent && parent.contains(element)) {
      parent.removeChild(element)
      if (parent !== state.iframeDocument.body) {
        checkIfNotifications()
      }
    }
  }, timeouts.removeElement)
}

function getPolarity() {
  const position =
    (state.config.style && state.config.style.notificationsPosition) || ''

  if (state.mobileDevice) {
    return position.includes('top') ? '-' : ''
  }

  return position.includes('Left') ? '-' : ''
}

export function offsetElement(el) {
  el.style.transform = `translate${
    state.mobileDevice ? 'Y' : 'X'
  }(${getPolarity()}${state.mobileDevice ? '150' : '600'}px)`
  return el
}

export function positionElement(el) {
  const position =
    (state.config.style && state.config.style.notificationsPosition) || ''

  el.style.left = state.mobileDevice
    ? 'initial'
    : position.includes('Left')
    ? '0px'
    : 'initial'
  el.style.right = state.mobileDevice
    ? 'initial'
    : position.includes('Right') || !position
    ? '0px'
    : 'initial'
  el.style.bottom = position.includes('bottom') || !position ? '0px' : 'initial'
  el.style.top = position.includes('top') ? '0px' : 'initial'

  return el
}

// Remove notification from DOM
export function removeNotification(notification) {
  const notificationsList = getByQuery('.bn-notifications')
  hideElement(notification)
  removeElement(notificationsList, notification)
  const scrollContainer = getByQuery('.bn-notifications-scroll')
  if (scrollContainer) {
    setTimeout(
      () => setHeight(scrollContainer, 'initial', 'auto'),
      timeouts.changeUI
    )
  }
}

export function removeAllNotifications(notifications) {
  notifications.forEach(notification => {
    if (notification) {
      removeNotification(notification)
    }
  })
}

export function checkIfNotifications() {
  const notificationsList = getByQuery('.bn-notifications')
  const allNotifications = Array.from(
    notificationsList.querySelectorAll('.bn-notification')
  )
  const visibleNotifications = allNotifications.filter(
    notification => notification.style.opacity !== '0'
  )

  if (visibleNotifications.length === 0) {
    removeContainer()
  }
}

// Remove notification container from DOM
export function removeContainer() {
  const notificationsContainer = getById('blocknative-notifications')
  hideElement(notificationsContainer)
  removeElement(state.iframeDocument.body, notificationsContainer)
  resizeIframe({ height: 0, width: 0 })
  hideIframe()
}

export function setNotificationsHeight() {
  const scrollContainer = getByQuery('.bn-notifications-scroll')
  // if no notifications to manipulate return
  if (!scrollContainer) return
  const maxHeight = window.innerHeight
  const branding = getById('bn-transaction-branding')
  const brandingHeight = branding ? branding.clientHeight + 26 : 0
  const widgetHeight = scrollContainer.clientHeight + brandingHeight

  const tooBig = widgetHeight > maxHeight

  if (tooBig) {
    setHeight(scrollContainer, 'scroll', maxHeight - brandingHeight)
    scrollContainer.scrollTop = maxHeight * 4
  } else {
    setHeight(scrollContainer, 'initial', 'auto')
  }

  const notificationsContainer = getById('blocknative-notifications')
  const toolTipBuffer = !tooBig && !state.mobileDevice ? 50 : 0

  resizeIframe({
    height: notificationsContainer.clientHeight + toolTipBuffer,
    width: state.mobileDevice ? window.innerWidth : 371,
    transitionHeight: true
  })
}

function setHeight(el, overflow, height) {
  if (el) {
    el.style['overflow-y'] = overflow
    el.style.height = height
  }
}

export function addTouchHandlers(element, type) {
  element.addEventListener('touchstart', handleTouchStart(element), false)
  element.addEventListener('touchmove', handleTouchMove(element), false)
  element.addEventListener('touchend', handleTouchEnd(element, type), false)
}

export function removeTouchHandlers(element, type) {
  element.removeEventListener('touchstart', handleTouchStart(element), false)
  element.removeEventListener('touchmove', handleTouchMove(element), false)
  element.removeEventListener('touchend', handleTouchEnd(element, type), false)
}

export function handleTouchStart(element) {
  return e => {
    e.stopPropagation()
    e.preventDefault()
    const touch = e.changedTouches[0]
    element.attributes['data-startY'] = touch.pageY
    element.attributes['data-startX'] = touch.pageX
    element.attributes['data-startTime'] = Date.now()
    element.attributes['data-translateY'] = 0
  }
}

export function handleTouchMove(element) {
  return e => {
    e.stopPropagation()
    e.preventDefault()
    const touch = e.changedTouches[0]
    const startY = element.attributes['data-startY']
    const translateY = element.attributes['data-translateY']
    const distanceY = touch.pageY - startY

    const newTranslateY = distanceY + translateY

    if (newTranslateY > -40 && newTranslateY < 40) {
      element.style.transform = `translateY(${newTranslateY}px)`
      element.attributes['data-translateY'] = newTranslateY
    }
  }
}

export function handleTouchEnd(element, type) {
  return e => {
    e.stopPropagation()
    e.preventDefault()
    const touch = e.changedTouches[0]
    const startY = element.attributes['data-startY']
    const startX = element.attributes['data-startX']
    const startTime = element.attributes['data-startTime']
    const distanceY = touch.pageY - startY
    const distanceX = touch.pageX - startX
    const elapsedTime = Date.now() - startTime
    const validDistance =
      distanceY <= -40 || distanceY >= 40 || distanceX <= -40 || distanceX >= 40
    const validSwipe = elapsedTime <= timeouts.swipeTime && validDistance

    if (!validSwipe) {
      element.style.transform = 'translateY(0)'
      element.attributes['data-translateY'] = 0
    } else {
      removeTouchHandlers(element)
      if (type === 'notification') {
        removeNotification(element)
      } else {
        closeModal()
      }
    }
  }
}

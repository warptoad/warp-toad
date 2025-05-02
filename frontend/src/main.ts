import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

declare global {
  interface Window {
    ethereum?: any; // or use `Ethereum` type from ethers if desired
  }
}

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app

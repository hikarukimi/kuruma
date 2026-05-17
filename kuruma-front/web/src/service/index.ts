export const apiBaseUrl = 'http://localhost:8080/api/v1'
export const wsBaseUrl = 'ws://localhost:8080/api/v1'
const authTokenStorageKey = 'kuruma.authToken'

let jwtToken=''

export function getJwtToken(){
    if(!jwtToken) {
        jwtToken = localStorage.getItem(authTokenStorageKey)
    }
    return jwtToken
}

export function authHeader() {
    if(!jwtToken) {
        getJwtToken()
    }

    return {
        Authorization: `Bearer ${jwtToken}`
    }
}
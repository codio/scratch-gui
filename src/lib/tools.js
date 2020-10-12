// Constant for encode/decode
const DECODE_ENCODE_STR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

export const encode64 = function (input) {

}

export const decode64buffer = function (input) {
    /* eslint-disable one-var */
    let chr1, chr2, chr3;
    let enc1, enc2, enc3, enc4;
    let i = 0, resultIndex = 0;

    /* eslint-disable no-useless-escape */
    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');

    let totalLength = input.length * 3 / 4;
    if (input.charAt(input.length - 1) === DECODE_ENCODE_STR.charAt(64)) {
        totalLength--;
    }
    if (input.charAt(input.length - 2) === DECODE_ENCODE_STR.charAt(64)) {
        totalLength--;
    }
    if (totalLength % 1 !== 0) {
        // totalLength is not an integer, the length does not match a valid
        // base64 content. That can happen if:
        // - the input is not a base64 content
        // - the input is *almost* a base64 content, with a extra chars at the
        //   beginning or at the end
        // - the input uses a base64 variant (base64url for example)
        throw new Error('Invalid base64 input, bad content length.');
    }
    const output = new Uint8Array(totalLength | 0);

    while (i < input.length) {

        enc1 = DECODE_ENCODE_STR.indexOf(input.charAt(i++));
        enc2 = DECODE_ENCODE_STR.indexOf(input.charAt(i++));
        enc3 = DECODE_ENCODE_STR.indexOf(input.charAt(i++));
        enc4 = DECODE_ENCODE_STR.indexOf(input.charAt(i++));

        chr1 = (enc1 << 2) | (enc2 >> 4);
        chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        chr3 = ((enc3 & 3) << 6) | enc4;

        output[resultIndex++] = chr1;

        if (enc3 !== 64) {
            output[resultIndex++] = chr2;
        }
        if (enc4 !== 64) {
            output[resultIndex++] = chr3;
        }

    }

    return output;
};

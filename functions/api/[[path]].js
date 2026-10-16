import backend from '../../worker-backend.js';
export const onRequest = ({request, env}) => backend.fetch(request, env);

import * as repo from './activity.repository.mjs';

export const list = ({ limitRaw, offsetRaw, q }) => repo.findAll({ limitRaw, offsetRaw, q });

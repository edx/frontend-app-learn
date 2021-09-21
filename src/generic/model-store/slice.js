/* eslint-disable no-param-reassign */
import { createSlice } from '@reduxjs/toolkit';

function add(state, modelType, model) {
  const { id } = model;
  if (state[modelType] === undefined) {
    state[modelType] = {};
  }
  if (modelType.includes('IdToHashKeyMap')) {
    state[modelType][model.hash_key] = id;
  }
  state[modelType][id] = model;
}

function update(state, modelType, model) {
  if (state[modelType] === undefined) {
    state[modelType] = {};
  }
  if (modelType.includes('IdToHashKeyMap')) {
    state[modelType][model.hash_key] = model.id;
  }
  state[modelType][model.id] = { ...state[modelType][model.id], ...model };
}

function remove(state, modelType, id) {
  if (state[modelType] === undefined) {
    state[modelType] = {};
  }

  delete state[modelType][id];
}

const slice = createSlice({
  name: 'models',
  initialState: {},
  reducers: {
    addModel: (state, { payload }) => {
      const { modelType, model } = payload;
      add(state, modelType, model);
    },
    addModels: (state, { payload }) => {
      const { modelType, models } = payload;
      models.forEach(model => add(state, modelType, model));
    },
    addModelsMap: (state, { payload }) => {
      const { modelType, modelsMap } = payload;
      Object.values(modelsMap).forEach(model => add(state, modelType, model));
    },
    updateModel: (state, { payload }) => {
      const { modelType, model } = payload;
      update(state, modelType, model);
    },
    updateModels: (state, { payload }) => {
      const { modelType, models } = payload;
      models.forEach(model => update(state, modelType, model));
    },
    updateModelsMap: (state, { payload }) => {
      const { modelType, modelsMap } = payload;
      Object.values(modelsMap).forEach(model => update(state, modelType, model));
    },
    removeModel: (state, { payload }) => {
      const { modelType, id } = payload;
      remove(state, modelType, id);
    },
    removeModels: (state, { payload }) => {
      const { modelType, ids } = payload;
      ids.forEach(id => remove(state, modelType, id));
    },
  },
});

export const {
  addModel,
  addModels,
  addModelsMap,
  updateModel,
  updateModels,
  updateModelsMap,
  removeModel,
  removeModels,
} = slice.actions;

export const { reducer } = slice;

/* SoriGraph AE bridge */
#target aftereffects

var SORI = SORI || {};

SORI.DEFAULT_MAX_SPEED = 0;

SORI.parsePayload = function (payload) {
  if (typeof JSON !== "undefined" && JSON.parse) {
    return JSON.parse(payload);
  }
  throw new Error("JSON parser is not available in this After Effects host.");
};

SORI.stringify = function (value) {
  if (typeof JSON !== "undefined" && JSON.stringify) {
    return JSON.stringify(value);
  }
  return value.toString();
};

SORI.respond = function (ok, message, data) {
  return SORI.stringify({
    ok: ok,
    message: message || "",
    data: data || null
  });
};

SORI.isProperty = function (item) {
  return item && item.propertyType === PropertyType.PROPERTY;
};

SORI.keyframesCanBeModified = function (property) {
  try {
    if (!SORI.isProperty(property) || !property.numKeys || property.numKeys < 1) {
      return false;
    }
    var pvt = property.propertyValueType;
    if (pvt === PropertyValueType.NO_VALUE ||
        pvt === PropertyValueType.CUSTOM_VALUE ||
        pvt === PropertyValueType.MARKER ||
        pvt === PropertyValueType.LAYER_INDEX ||
        pvt === PropertyValueType.MASK_INDEX ||
        pvt === PropertyValueType.TEXT_DOCUMENT) {
      return false;
    }
  } catch (e) {
    return false;
  }
  return true;
};

SORI.getActiveComp = function () {
  var item = app.project && app.project.activeItem;
  if (!item || !(item instanceof CompItem)) {
    return null;
  }
  return item;
};

// Build a unique string key for a property to detect duplicates.
// Uses the property's matchName chain up through parents for uniqueness.
SORI.propertyKey = function (property) {
  var key = "";
  try {
    var p = property;
    while (p) {
      key = (p.matchName || p.name || "") + "/" + key;
      p = p.parentProperty || null;
    }
  } catch (e) {}
  return key;
};

SORI.collectSelectedKeyedProperties = function () {
  var comp = SORI.getActiveComp();
  if (!comp) {
    return {
      error: "Please select a composition first."
    };
  }

  var result = [];
  var seen = {};
  var selected = comp.selectedProperties;

  for (var i = 0; i < selected.length; i += 1) {
    SORI.collectProperty(selected[i], result, seen);
  }

  if (result.length === 0) {
    return {
      error: "Please select at least one animated property/keyframe."
    };
  }

  return {
    items: result
  };
};

SORI.collectProperty = function (property, result, seen) {
  if (!property) {
    return;
  }

  try {
    if (property.isSeparationLeader && property.dimensionsSeparated && property.numProperties) {
      for (var childIndex = 1; childIndex <= property.numProperties; childIndex += 1) {
        SORI.collectProperty(property.property(childIndex), result, seen);
      }
      return;
    }
  } catch (e) {}

  if (SORI.keyframesCanBeModified(property) && property.selectedKeys && property.selectedKeys.length > 0) {
    var key = SORI.propertyKey(property);
    if (!seen[key]) {
      seen[key] = true;
      result.push({
        property: property,
        keys: property.selectedKeys
      });
    }
    return;
  }

  if (property.numProperties) {
    for (var i = 1; i <= property.numProperties; i += 1) {
      SORI.collectProperty(property.property(i), result, seen);
    }
  }
};

SORI.valueLength = function (property) {
  try {
    var value = property.value;
    if (value instanceof Array) {
      return value.length;
    }
  } catch (error) {}
  return 1;
};

SORI.easeLength = function (property, keyIndex) {
  try {
    var inEase = property.keyInTemporalEase(keyIndex);
    if (inEase && inEase.length > 0) {
      return inEase.length;
    }
  } catch (error) {}

  try {
    var outEase = property.keyOutTemporalEase(keyIndex);
    if (outEase && outEase.length > 0) {
      return outEase.length;
    }
  } catch (error) {}

  if (SORI.isSpatialProperty(property)) {
    return 1;
  }
  return SORI.valueLength(property);
};

SORI.isSpatialProperty = function (property) {
  try {
    if (typeof property.isSpatial === "boolean") {
      return property.isSpatial;
    }
    var pvt = property.propertyValueType;
    if (pvt === PropertyValueType.TwoD_SPATIAL ||
        pvt === PropertyValueType.ThreeD_SPATIAL) {
      return true;
    }
  } catch (e) {}
  return false;
};

SORI.componentValue = function (value, index) {
  if (value instanceof Array) {
    return Number(value[Math.min(index, value.length - 1)]) || 0;
  }
  return Number(value) || 0;
};

SORI.adjacentKeyIndex = function (property, keyIndex, side) {
  if (side === "out") {
    return Math.min(property.numKeys, keyIndex + 1);
  }
  return Math.max(1, keyIndex - 1);
};

SORI.segmentSpeed = function (property, keyIndex, side, dimension) {
  var otherIndex = SORI.adjacentKeyIndex(property, keyIndex, side);

  if (otherIndex === keyIndex) {
    return 0;
  }

  var t1 = property.keyTime(keyIndex);
  var t2 = property.keyTime(otherIndex);
  var dt = Math.abs(t2 - t1);
  if (dt <= 0.00001) {
    return 0;
  }

  var v1 = property.keyValue(keyIndex);
  var v2 = property.keyValue(otherIndex);

  if (v1 instanceof Array) {
    if (SORI.isSpatialProperty(property)) {
      // Spatial properties -> Euclidean distance magnitude (always positive)
      var sumSq = 0;
      for (var d = 0; d < v1.length; d += 1) {
        var val1 = Number(v1[d]) || 0;
        var val2 = Number(v2[d]) || 0;
        var diff = val2 - val1;
        sumSq += diff * diff;
      }
      return Math.sqrt(sumSq) / dt;
    } else {
      var val1 = SORI.componentValue(v1, dimension || 0);
      var val2 = SORI.componentValue(v2, dimension || 0);
      var diff = (side === "out") ? (val2 - val1) : (val1 - val2);
      return diff / dt;
    }
  } else {
    // 1D property -> Signed velocity
    var val1 = Number(v1) || 0;
    var val2 = Number(v2) || 0;
    var diff = (side === "out") ? (val2 - val1) : (val1 - val2);
    return diff / dt;
  }
};

SORI.avgSpeed = function (property, keyIndex, side) {
  return SORI.segmentSpeed(property, keyIndex, side, 0);
};

SORI.clamp = function (value, min, max) {
  return Math.min(max, Math.max(min, value));
};

SORI.safeInfluence = function (value) {
  return SORI.clamp(Math.abs(value), 0.1, 100);
};

SORI.safeSpeed = function (value, maxSpeed) {
  if (!isFinite(value)) {
    return 0;
  }
  maxSpeed = Number(maxSpeed) || SORI.DEFAULT_MAX_SPEED;
  if (maxSpeed > 0) {
    var sign = value < 0 ? -1 : 1;
    return sign * Math.min(Math.abs(value), maxSpeed);
  }
  return value;
};

SORI.makeEaseArray = function (property, keyIndex, side, curve, maxSpeed) {
  var x;
  var y;
  var influence;
  var valueDims = SORI.valueLength(property);
  var easeDims = SORI.easeLength(property, keyIndex);
  var isSpatial = SORI.isSpatialProperty(property);
  var result = [];

  if (side === "out") {
    x = Math.max(0.001, curve[0]);
    y = curve[1];
    influence = SORI.safeInfluence(x * 100);
  } else {
    x = Math.max(0.001, 1 - curve[2]);
    y = 1 - curve[3];
    influence = SORI.safeInfluence(x * 100);
  }

  if (valueDims > 1 && easeDims > 1 && !isSpatial) {
    // Non-spatial multi-dimensional (Scale, Orientation, Point Controls)
    // -> Apply independent, signed component speeds for each dimension.
    var otherIndex = SORI.adjacentKeyIndex(property, keyIndex, side);
    if (otherIndex !== keyIndex) {
      var t1 = property.keyTime(keyIndex);
      var t2 = property.keyTime(otherIndex);
      var dt = Math.abs(t2 - t1);
      if (dt > 0.00001) {
        var v1 = property.keyValue(keyIndex);
        var v2 = property.keyValue(otherIndex);
        for (var d = 0; d < easeDims; d += 1) {
          var val1 = SORI.componentValue(v1, d);
          var val2 = SORI.componentValue(v2, d);
          var diff = (side === "out") ? (val2 - val1) : (val1 - val2);
          var compBaseSpeed = diff / dt;
          var compSpeed = SORI.safeSpeed(compBaseSpeed * (y / x), maxSpeed);
          result.push(new KeyframeEase(compSpeed, influence));
        }
        return result;
      }
    }
    // Fallback: no adjacent key or zero duration
    for (var d = 0; d < easeDims; d += 1) {
      result.push(new KeyframeEase(0, influence));
    }
    return result;
  } else {
    // Spatial (Position) or 1D (Opacity, Rotation, Sliders)
    var baseSpeed = SORI.avgSpeed(property, keyIndex, side);
    var speed;
    if (isSpatial) {
      // Spatial properties: AE requires speed >= 0 (no negative speeds)
      speed = Math.abs(SORI.safeSpeed(baseSpeed * (y / x), maxSpeed));
    } else {
      // 1D: preserve sign for directional easing
      speed = SORI.safeSpeed(baseSpeed * (y / x), maxSpeed);
    }
    var easeObj = new KeyframeEase(speed, influence);
    for (var d = 0; d < easeDims; d += 1) {
      result.push(easeObj);
    }
    return result;
  }
};

SORI.makeF9EaseArray = function (property, keyIndex) {
  var dims = SORI.easeLength(property, keyIndex);
  var result = [];
  for (var d = 0; d < dims; d += 1) {
    result.push(new KeyframeEase(0, 33.3333));
  }
  return result;
};

// Find the dominant dimension (dimension with the largest absolute value change)
// for reading easing handles most accurately.
SORI.findDominantDim = function (property, keyIndex1, keyIndex2) {
  var dims = SORI.valueLength(property);
  var maxDim = 0;
  if (dims > 1) {
    try {
      var v1 = property.keyValue(keyIndex1);
      var v2 = property.keyValue(keyIndex2);
      var maxVal = -1;
      for (var d = 0; d < dims; d += 1) {
        var diff = Math.abs((Number(v2[d]) || 0) - (Number(v1[d]) || 0));
        if (diff > maxVal) {
          maxVal = diff;
          maxDim = d;
        }
      }
    } catch (e) {}
  }
  return maxDim;
};

SORI.curveFromKey = function (property, keyIndex) {
  var dims = SORI.easeLength(property, keyIndex);
  var maxDim = 0;

  if (dims > 1 && !SORI.isSpatialProperty(property)) {
    var otherIndex = (keyIndex < property.numKeys) ? (keyIndex + 1) : (keyIndex > 1 ? keyIndex - 1 : keyIndex);
    if (otherIndex !== keyIndex) {
      maxDim = SORI.findDominantDim(property, keyIndex, otherIndex);
    }
  }

  var outEase = property.keyOutTemporalEase(keyIndex)[maxDim];
  var inEase = property.keyInTemporalEase(keyIndex)[maxDim];
  var outBase = SORI.segmentSpeed(property, keyIndex, "out", maxDim) || 1;
  var inBase = SORI.segmentSpeed(property, keyIndex, "in", maxDim) || 1;

  var x1 = SORI.clamp(outEase.influence / 100, 0, 1);
  var y1 = SORI.clamp((outEase.speed / outBase) * Math.max(x1, 0.001), -1.5, 3.5);
  var x2 = SORI.clamp(1 - (inEase.influence / 100), 0, 1);
  var y2 = SORI.clamp(1 - ((inEase.speed / inBase) * Math.max(1 - x2, 0.001)), -1.5, 3.5);

  return {
    curve: [x1, y1, x2, y2],
    outSpeed: outEase.speed,
    outInfluence: outEase.influence,
    inSpeed: inEase.speed,
    inInfluence: inEase.influence,
    outBase: outBase,
    inBase: inBase
  };
};

SORI.curveFromSegment = function (property, keyIndex1, keyIndex2) {
  var maxDim = SORI.isSpatialProperty(property) ? 0 : SORI.findDominantDim(property, keyIndex1, keyIndex2);

  var outEase = property.keyOutTemporalEase(keyIndex1)[maxDim];
  var inEase = property.keyInTemporalEase(keyIndex2)[maxDim];
  var outBase = SORI.segmentSpeed(property, keyIndex1, "out", maxDim) || 1;
  var inBase = SORI.segmentSpeed(property, keyIndex2, "in", maxDim) || 1;

  var x1 = SORI.clamp(outEase.influence / 100, 0, 1);
  var y1 = SORI.clamp((outEase.speed / outBase) * Math.max(x1, 0.001), -1.5, 3.5);
  var x2 = SORI.clamp(1 - (inEase.influence / 100), 0, 1);
  var y2 = SORI.clamp(1 - ((inEase.speed / inBase) * Math.max(1 - x2, 0.001)), -1.5, 3.5);

  return {
    curve: [x1, y1, x2, y2],
    outSpeed: outEase.speed,
    outInfluence: outEase.influence,
    inSpeed: inEase.speed,
    inInfluence: inEase.influence,
    outBase: outBase,
    inBase: inBase
  };
};

SORI.prepareTemporalKey = function (property, keyIndex, direction) {
  var currentInType = property.keyInInterpolationType(keyIndex);
  var currentOutType = property.keyOutInterpolationType(keyIndex);
  var needsIn = (direction === "both" || direction === "in");
  var needsOut = (direction === "both" || direction === "out");
  var newInType = needsIn ? KeyframeInterpolationType.BEZIER : currentInType;
  var newOutType = needsOut ? KeyframeInterpolationType.BEZIER : currentOutType;

  try {
    property.setRovingAtKey(keyIndex, false);
  } catch (e) {}

  property.setInterpolationTypeAtKey(keyIndex, newInType, newOutType);

  try {
    property.setTemporalAutoBezierAtKey(keyIndex, false);
  } catch (e) {}

  try {
    property.setTemporalContinuousAtKey(keyIndex, false);
  } catch (e) {}
};

SORI.applyCurveToKey = function (property, keyIndex, curve, direction, maxSpeed, presetId) {
  // Ensure the keyframe uses Bezier temporal interpolation before setting ease.
  // Some properties (e.g. marker, text source) don't support Bezier at all.
  try {
    SORI.prepareTemporalKey(property, keyIndex, direction);
  } catch (e) {
    // Property doesn't support Bezier interpolation — skip it
    throw new Error("Interpolation not supported");
  }

  var inEase = property.keyInTemporalEase(keyIndex);
  var outEase = property.keyOutTemporalEase(keyIndex);

  if (presetId === "ease") {
    var f9Array = SORI.makeF9EaseArray(property, keyIndex);
    if (direction === "both" || direction === "in") {
      inEase = f9Array;
    }
    if (direction === "both" || direction === "out") {
      outEase = f9Array;
    }
  } else {
    if (direction === "both" || direction === "in") {
      inEase = SORI.makeEaseArray(property, keyIndex, "in", curve, maxSpeed);
    }
    if (direction === "both" || direction === "out") {
      outEase = SORI.makeEaseArray(property, keyIndex, "out", curve, maxSpeed);
    }
  }

  property.setTemporalEaseAtKey(keyIndex, inEase, outEase);
};

SORI.flattenSelectionKeys = function (selection) {
  var keys = [];
  for (var i = 0; i < selection.items.length; i += 1) {
    var item = selection.items[i];
    for (var k = 0; k < item.keys.length; k += 1) {
      keys.push({
        property: item.property,
        keyIndex: item.keys[k]
      });
    }
  }
  return keys;
};

SORI.getSegmentAwareDirection = function (property, keyIndex, isKeySelected, baseDirection) {
  var prevSelected = !!isKeySelected[keyIndex - 1];
  var nextSelected = !!isKeySelected[keyIndex + 1];
  var isolated = !prevSelected && !nextSelected;

  var wantIn = prevSelected || isolated;
  var wantOut = nextSelected || isolated;

  var allowIn = (baseDirection === "both" || baseDirection === "in");
  var allowOut = (baseDirection === "both" || baseDirection === "out");

  var applyIn = wantIn && allowIn;
  var applyOut = wantOut && allowOut;

  if (applyIn && applyOut) {
    return "both";
  } else if (applyIn) {
    return "in";
  } else if (applyOut) {
    return "out";
  }
  return "";
};

SORI.applyCurve = function (payload) {
  var data;
  try {
    data = SORI.parsePayload(payload);
  } catch (error) {
    return SORI.respond(false, "Could not read apply data.");
  }
  var curve = data.curve || [0, 0, 1, 1];
  var direction = data.direction || "both";
  var maxSpeed = SORI.DEFAULT_MAX_SPEED;
  var presetId = data.presetId || "";
  var selection = SORI.collectSelectedKeyedProperties();

  if (selection.error) {
    return SORI.respond(false, selection.error);
  }

  app.beginUndoGroup("SoriGraph Apply Ease");

  var changed = 0;
  var skipped = 0;
  var totalKeys = 0;

  try {
    for (var i = 0; i < selection.items.length; i += 1) {
      var item = selection.items[i];
      var property = item.property;

      var keys = item.keys.slice();
      keys.sort(function (a, b) { return a - b; });

      var isKeySelected = {};
      for (var k = 0; k < keys.length; k += 1) {
        isKeySelected[keys[k]] = true;
      }

      for (var k = 0; k < keys.length; k += 1) {
        var keyIndex = keys[k];
        totalKeys += 1;

        var targetDirection = SORI.getSegmentAwareDirection(property, keyIndex, isKeySelected, direction);
        if (targetDirection === "") {
          continue;
        }

        try {
          SORI.applyCurveToKey(property, keyIndex, curve, targetDirection, maxSpeed, presetId);
          changed += 1;
        } catch (error) {
          skipped += 1;
        }
      }
    }
  } finally {
    app.endUndoGroup();
  }

  if (changed === 0) {
    return SORI.respond(false, "No compatible keyframes were changed.");
  }

  var message = "Applied to " + changed + " keyframe" + (changed === 1 ? "" : "s") + ".";
  return SORI.respond(true, message, {
    changed: changed,
    skipped: skipped
  });
};

SORI.readCurve = function () {
  var selection = SORI.collectSelectedKeyedProperties();

  if (selection.error) {
    return SORI.respond(false, selection.error);
  }

  var property = selection.items[0].property;

  var keys = selection.items[0].keys.slice();
  keys.sort(function (a, b) { return a - b; });
  var keyIndex = keys[0];

  try {
    var result;

    if (keys.length >= 2 && keys[1] === keyIndex + 1) {
      // Two consecutive keys selected — read the segment between them
      result = SORI.curveFromSegment(property, keyIndex, keys[1]);
    } else if (keyIndex < property.numKeys) {
      // Single key selected with a next key — read the segment to the next key
      result = SORI.curveFromSegment(property, keyIndex, keyIndex + 1);
    } else if (keyIndex > 1) {
      // Last key selected — read the segment from the previous key
      result = SORI.curveFromSegment(property, keyIndex - 1, keyIndex);
    } else {
      // Only one key total — fall back to single-key reading
      result = SORI.curveFromKey(property, keyIndex);
    }

    return SORI.respond(true, "Read selected keyframe easing.", result);
  } catch (error) {
    return SORI.respond(false, "Could not read easing from the selected keyframe.");
  }
};

SORI.copyEaseSelection = function () {
  var selection = SORI.collectSelectedKeyedProperties();

  if (selection.error) {
    return SORI.respond(false, selection.error);
  }

  var selectedKeys = SORI.flattenSelectionKeys(selection);
  var copied = [];
  var skipped = 0;

  for (var i = 0; i < selectedKeys.length; i += 1) {
    try {
      var source = selectedKeys[i];
      copied.push(SORI.curveFromKey(source.property, source.keyIndex));
    } catch (error) {
      skipped += 1;
    }
  }

  if (!copied.length) {
    return SORI.respond(false, "Could not copy easing from the selected keyframes.");
  }

  var message = "Copied " + copied.length + " ease" + (copied.length === 1 ? "" : "s") + ".";
  if (skipped > 0) {
    message += " Skipped " + skipped + ".";
  }

  return SORI.respond(true, message, {
    items: copied,
    count: copied.length,
    skipped: skipped
  });
};

SORI.pasteEaseSelection = function (payload) {
  var data;
  try {
    data = SORI.parsePayload(payload);
  } catch (error) {
    return SORI.respond(false, "Could not read copied easing.");
  }

  var copied = data.items || [];
  var direction = data.direction || "both";
  var maxSpeed = SORI.DEFAULT_MAX_SPEED;

  if (!copied.length) {
    return SORI.respond(false, "Copy an ease first.");
  }

  var selection = SORI.collectSelectedKeyedProperties();
  if (selection.error) {
    return SORI.respond(false, selection.error);
  }

  var targetKeys = SORI.flattenSelectionKeys(selection);
  if (!targetKeys.length) {
    return SORI.respond(false, "Please select target keyframes.");
  }

  if (targetKeys.length % copied.length !== 0 && copied.length % targetKeys.length !== 0) {
    return SORI.respond(false, "Select the same number of target keys, or a multiple of the copied keys.");
  }

  app.beginUndoGroup("SoriGraph Paste Ease");

  var changed = 0;
  var skipped = 0;
  var pasteIndex = 0;

  try {
    for (var i = 0; i < selection.items.length; i += 1) {
      var item = selection.items[i];
      var property = item.property;

      var keys = item.keys.slice();
      keys.sort(function (a, b) { return a - b; });

      var isKeySelected = {};
      for (var k = 0; k < keys.length; k += 1) {
        isKeySelected[keys[k]] = true;
      }

      for (var k = 0; k < keys.length; k += 1) {
        var keyIndex = keys[k];
        var source = copied[pasteIndex % copied.length];
        pasteIndex += 1;

        var targetDirection = SORI.getSegmentAwareDirection(property, keyIndex, isKeySelected, direction);
        if (targetDirection === "") {
          continue;
        }

        try {
          SORI.applyCurveToKey(property, keyIndex, source.curve, targetDirection, maxSpeed, "");
          changed += 1;
        } catch (error) {
          skipped += 1;
        }
      }
    }
  } finally {
    app.endUndoGroup();
  }

  if (!changed) {
    return SORI.respond(false, "No compatible keyframes were changed.");
  }

  var message = "Pasted ease to " + changed + " keyframe" + (changed === 1 ? "" : "s") + ".";
  if (skipped > 0) {
    message += " Skipped " + skipped + ".";
  }

  return SORI.respond(true, message, {
    changed: changed,
    skipped: skipped
  });
};

SORI.separateSelectedProperties = function () {
  var active = app.project.activeItem;
  if (!active || !(active instanceof CompItem)) {
    return SORI.respond(false, "No active composition.");
  }
  
  app.beginUndoGroup("Separate Dimensions");
  
  var layers = active.selectedLayers;
  var separatedCount = 0;
  
  for (var i = 0; i < layers.length; i += 1) {
    var layer = layers[i];
    var selectedProps = layer.selectedProperties;
    
    // We collect properties to separate to avoid modifying the selection array while iterating
    var toSeparate = [];
    for (var j = 0; j < selectedProps.length; j += 1) {
      var prop = selectedProps[j];
      if ((prop.matchName === "ADBE Position" || prop.name === "Position") && !prop.dimensionsSeparated) {
        toSeparate.push(prop);
      }
    }
    
    for (var k = 0; k < toSeparate.length; k += 1) {
      var posProp = toSeparate[k];
      
      // Store selected keyframe indices before separation
      var selKeys = [];
      if (posProp.numKeys && posProp.selectedKeys) {
        for (var s = 0; s < posProp.selectedKeys.length; s += 1) {
          selKeys.push(posProp.selectedKeys[s]);
        }
      }
      
      try {
        posProp.dimensionsSeparated = true;
        separatedCount += 1;
        
        // After separating, the components (X, Y, Z Position) will be visible.
        // Let's make sure they are selected, along with their keyframes.
        var parentGroup = posProp.parentProperty;
        if (parentGroup) {
          var xProp = parentGroup.property("X Position") || parentGroup.property("ADBE Position_0");
          var yProp = parentGroup.property("Y Position") || parentGroup.property("ADBE Position_1");
          var zProp = parentGroup.property("Z Position") || parentGroup.property("ADBE Position_2");
          
          var components = [xProp, yProp, zProp];
          for (var c = 0; c < components.length; c += 1) {
            var compProp = components[c];
            if (compProp) {
              compProp.selected = true;
              // Reselect keyframes at the same indices
              for (var s = 0; s < selKeys.length; s += 1) {
                if (selKeys[s] <= compProp.numKeys) {
                  compProp.setSelectedAtKey(selKeys[s], true);
                }
              }
            }
          }
        }
      } catch (e) {
        // Fallback if property doesn't support separate dimensions
      }
    }
  }
  
  app.endUndoGroup();
  
  if (separatedCount > 0) {
    return SORI.respond(true, "Separated dimensions for " + separatedCount + " position properties.");
  }
  return SORI.respond(false, "No unseparated Position property found in selection.");
};

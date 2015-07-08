package foam.android.view;

import android.content.Context;
import android.util.AttributeSet;
import android.widget.TextView;

import foam.core.AbstractStringProperty;
import foam.core.Value;
import foam.core.X;

/**
 * FOAM wrapper for Android's TextView.
 *
 * Expects either a {@link X} with "data" to be a {@link Value}, or {@link #setValue(Value)} to be
 * called with a {@link Value} for an {@link AbstractStringProperty}.
 */
public class TextViewAdapter extends OneWayViewAdapter<TextView> {
  public TextViewAdapter(Context context) {
    view = new TextView(context);
  }
  public TextViewAdapter(Context context, AttributeSet attrs) {
    view = new TextView(context, attrs);
  }

  protected void updateViewFromValue() {
    view.setText((String) value.get());
  }
}

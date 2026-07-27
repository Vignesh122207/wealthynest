package com.wealthynest.infrastructure.constructs;

import software.amazon.awscdk.services.cloudwatch.Alarm;
import software.amazon.awscdk.services.cloudwatch.ComparisonOperator;
import software.amazon.awscdk.services.cloudwatch.IMetric;
import software.amazon.awscdk.services.cloudwatch.TreatMissingData;
import software.amazon.awscdk.services.cloudwatch.actions.SnsAction;
import software.amazon.awscdk.services.sns.ITopic;
import software.constructs.Construct;

/**
 * Builds a {@link Alarm} wired to the shared alarm SNS topic (both ALARM and OK actions), so
 * every alarm across every stack is created and notified the same way instead of re-wiring
 * {@code addAlarmAction}/{@code addOkAction} at each call site.
 */
public final class AlarmFactory {

    private final Construct scope;
    private final ITopic alarmTopic;

    public AlarmFactory(Construct scope, ITopic alarmTopic) {
        this.scope = scope;
        this.alarmTopic = alarmTopic;
    }

    public Alarm threshold(
        String id,
        IMetric metric,
        double threshold,
        int evaluationPeriods,
        ComparisonOperator comparisonOperator,
        String description
    ) {
        Alarm alarm = Alarm.Builder.create(scope, id)
            .alarmName(id)
            .metric(metric)
            .threshold(threshold)
            .evaluationPeriods(evaluationPeriods)
            .comparisonOperator(comparisonOperator)
            .treatMissingData(TreatMissingData.NOT_BREACHING)
            .alarmDescription(description)
            .build();

        SnsAction notify = new SnsAction(alarmTopic);
        alarm.addAlarmAction(notify);
        alarm.addOkAction(notify);
        return alarm;
    }
}
